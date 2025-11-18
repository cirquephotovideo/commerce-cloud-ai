-- Corriger la fonction bulk_create_all_supplier_links_by_ean pour utiliser confidence_score en 0-1 et link_type='auto'
CREATE OR REPLACE FUNCTION bulk_create_all_supplier_links_by_ean(p_user_id UUID)
RETURNS TABLE(
  links_created INTEGER,
  products_matched INTEGER,
  execution_time_ms INTEGER
) AS $$
DECLARE
  start_time TIMESTAMP;
  inserted_count INTEGER;
  matched_products INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  -- Créer TOUS les liens possibles par EAN (1 analysis → N suppliers)
  WITH inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT DISTINCT
      pa.id AS analysis_id,
      sp.id AS supplier_product_id,
      'auto' AS link_type,  -- Fixed: use 'auto' instead of 'automatic'
      1.0 AS confidence_score,  -- Fixed: use 1.0 (0-1 scale) instead of 100
      p_user_id
    FROM product_analyses pa
    INNER JOIN supplier_products sp 
      ON pa.ean = sp.ean
    WHERE pa.user_id = p_user_id
      AND sp.user_id = p_user_id
      AND pa.ean IS NOT NULL
      AND sp.ean IS NOT NULL
      AND pa.ean != ''
      AND sp.ean != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_links pl
        WHERE pl.analysis_id = pa.id 
          AND pl.supplier_product_id = sp.id
      )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING analysis_id, supplier_product_id
  ),
  unique_analyses AS (
    SELECT COUNT(DISTINCT analysis_id) AS count FROM inserted
  )
  SELECT 
    COUNT(*)::INTEGER,
    (SELECT count FROM unique_analyses)::INTEGER
  INTO inserted_count, matched_products
  FROM inserted;
  
  RETURN QUERY SELECT 
    inserted_count,
    matched_products,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;