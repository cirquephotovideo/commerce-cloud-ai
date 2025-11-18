-- 1. Créer des index sur les tables sources pour accélérer les calculs
CREATE INDEX IF NOT EXISTS idx_product_links_analysis_supplier 
  ON product_links(analysis_id, supplier_product_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_price 
  ON supplier_products(supplier_id, purchase_price) 
  WHERE purchase_price > 0;

CREATE INDEX IF NOT EXISTS idx_product_analyses_user_ean 
  ON product_analyses(user_id, ean) 
  WHERE ean IS NOT NULL;

-- 2. Créer la vue matérialisée SANS données (évite le timeout initial)
CREATE MATERIALIZED VIEW unified_products_materialized AS
SELECT 
  pa.id AS analysis_id,
  pa.user_id,
  pa.ean,
  COALESCE(pa.analysis_result->>'name', pa.analysis_result->>'title', 'Sans nom') AS product_name,
  (pa.analysis_result->>'brand') AS brand,
  CASE 
    WHEN jsonb_array_length(pa.image_urls) > 0 THEN (pa.image_urls->0)::TEXT
    ELSE NULL
  END AS primary_image,
  COUNT(DISTINCT sp.id) FILTER (WHERE sp.id IS NOT NULL) AS supplier_count,
  MIN(sp.purchase_price) FILTER (WHERE sp.purchase_price > 0) AS best_price,
  MAX(sp.purchase_price) FILTER (WHERE sp.purchase_price > 0) AS worst_price,
  AVG(sp.purchase_price) FILTER (WHERE sp.purchase_price > 0) AS avg_price,
  SUM(sp.stock_quantity) FILTER (WHERE sp.stock_quantity > 0) AS total_stock,
  jsonb_agg(
    jsonb_build_object(
      'supplier_id', sc.id,
      'supplier_name', sc.supplier_name,
      'supplier_reference', sp.supplier_reference,
      'purchase_price', sp.purchase_price,
      'stock_quantity', sp.stock_quantity,
      'last_updated', sp.last_updated
    ) ORDER BY sp.purchase_price ASC NULLS LAST
  ) FILTER (WHERE sp.id IS NOT NULL) AS suppliers,
  (pa.analysis_result->>'selling_price')::NUMERIC AS selling_price,
  pa.margin_percentage,
  pa.enrichment_status,
  pa.created_at,
  CASE 
    WHEN COUNT(DISTINCT sp.id) > 1 
      AND MIN(sp.purchase_price) FILTER (WHERE sp.purchase_price > 0) IS NOT NULL 
      AND MAX(sp.purchase_price) FILTER (WHERE sp.purchase_price > 0) IS NOT NULL
    THEN MAX(sp.purchase_price) - MIN(sp.purchase_price)
    ELSE 0
  END AS potential_savings
FROM product_analyses pa
LEFT JOIN product_links pl ON pa.id = pl.analysis_id
LEFT JOIN supplier_products sp ON pl.supplier_product_id = sp.id
LEFT JOIN supplier_configurations sc ON sp.supplier_id = sc.id
GROUP BY pa.id, pa.user_id, pa.ean, pa.analysis_result, pa.image_urls, pa.margin_percentage, pa.enrichment_status, pa.created_at
WITH NO DATA;

-- 3. Créer l'index unique (nécessaire pour REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX idx_unified_mat_analysis_id ON unified_products_materialized(analysis_id);

-- 4. Créer les index d'optimisation
CREATE INDEX idx_unified_mat_user_id ON unified_products_materialized(user_id);
CREATE INDEX idx_unified_mat_ean ON unified_products_materialized(ean);
CREATE INDEX idx_unified_mat_created ON unified_products_materialized(created_at DESC);
CREATE INDEX idx_unified_mat_supplier_count ON unified_products_materialized(supplier_count) WHERE supplier_count > 0;

-- 5. Fonction pour rafraîchir la vue (avec timeout étendu)
CREATE OR REPLACE FUNCTION refresh_unified_products_materialized()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10min'
AS $$
BEGIN
  -- Utiliser REFRESH normal au lieu de CONCURRENTLY pour éviter les blocages
  REFRESH MATERIALIZED VIEW unified_products_materialized;
END;
$$;

-- 6. Cron job pour rafraîchir la vue toutes les heures (5 min après le sync EAN)
SELECT cron.schedule(
  'hourly-refresh-unified-view',
  '5 * * * *',
  $$SELECT refresh_unified_products_materialized()$$
);

-- 7. Modifier get_unified_products pour utiliser la vue matérialisée
CREATE OR REPLACE FUNCTION get_unified_products(
  p_user_id UUID,
  p_search_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT *
    FROM unified_products_materialized
    WHERE user_id = p_user_id
      AND (
        p_search_query IS NULL 
        OR product_name ILIKE '%' || p_search_query || '%'
        OR ean ILIKE '%' || p_search_query || '%'
        OR brand ILIKE '%' || p_search_query || '%'
      )
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;
  
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;