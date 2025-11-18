-- RPC function to get unified products directly (no materialized view)
CREATE OR REPLACE FUNCTION get_unified_products(
  p_user_id UUID,
  p_search_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT 
      pa.id AS analysis_id,
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
    WHERE pa.user_id = p_user_id
      AND (
        p_search_query IS NULL 
        OR COALESCE(pa.analysis_result->>'name', pa.analysis_result->>'title', '') ILIKE '%' || p_search_query || '%'
        OR pa.ean ILIKE '%' || p_search_query || '%'
        OR (pa.analysis_result->>'brand') ILIKE '%' || p_search_query || '%'
      )
    GROUP BY pa.id, pa.ean, pa.analysis_result, pa.image_urls, pa.margin_percentage, pa.enrichment_status, pa.created_at
    ORDER BY pa.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;
  
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;