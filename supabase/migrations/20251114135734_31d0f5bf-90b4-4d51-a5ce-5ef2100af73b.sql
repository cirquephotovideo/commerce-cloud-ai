-- Corriger la fonction bulk_create_product_links_chunked
DROP FUNCTION IF EXISTS bulk_create_product_links_chunked(uuid, integer, integer);

CREATE OR REPLACE FUNCTION bulk_create_product_links_chunked(p_user_id uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE(links_created integer, processed_count integer, has_more boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
  total_analyzed INTEGER;
BEGIN
  SET LOCAL statement_timeout = '120s';
  
  WITH batch_analyses AS (
    SELECT id, normalized_ean
    FROM product_analyses
    WHERE user_id = p_user_id
      AND normalized_ean IS NOT NULL
    ORDER BY id
    LIMIT p_limit
    OFFSET p_offset
  ),
  inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT 
      ba.id,
      sp.id,
      'auto',
      1.0,
      p_user_id
    FROM batch_analyses ba
    INNER JOIN supplier_products sp 
      ON sp.normalized_ean = ba.normalized_ean
      AND sp.user_id = p_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_links pl
      WHERE pl.analysis_id = ba.id 
        AND pl.supplier_product_id = sp.id
    )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT 
    COUNT(*)::INTEGER INTO inserted_count
  FROM inserted;
  
  SELECT COUNT(*)::INTEGER INTO total_analyzed
  FROM batch_analyses;
  
  RETURN QUERY SELECT 
    inserted_count,
    total_analyzed,
    total_analyzed >= p_limit;
END;
$$;