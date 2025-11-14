-- Fix MAX(uuid) error in bulk_create_product_links_cursor
DROP FUNCTION IF EXISTS public.bulk_create_product_links_cursor(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.bulk_create_product_links_cursor(
  p_user_id uuid,
  p_limit integer DEFAULT 100,
  p_after uuid DEFAULT NULL
)
RETURNS TABLE(links_created integer, processed_count integer, last_id uuid, has_more boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_id uuid;
  v_processed_count integer;
  v_links_created integer;
BEGIN
  SET LOCAL statement_timeout = '120s';

  -- Get batch and last_id
  WITH batch_analyses AS (
    SELECT id, normalized_ean
    FROM product_analyses
    WHERE user_id = p_user_id
      AND normalized_ean IS NOT NULL
      AND (p_after IS NULL OR id > p_after)
    ORDER BY id
    LIMIT p_limit
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
      ON sp.user_id = p_user_id
      AND sp.normalized_ean = ba.normalized_ean
    WHERE NOT EXISTS (
      SELECT 1 FROM product_links pl
      WHERE pl.analysis_id = ba.id 
        AND pl.supplier_product_id = sp.id
    )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT 
    COUNT(*)::INTEGER,
    (SELECT COUNT(*)::INTEGER FROM batch_analyses),
    (SELECT id FROM batch_analyses ORDER BY id DESC LIMIT 1)
  INTO v_links_created, v_processed_count, v_last_id
  FROM inserted;

  RETURN QUERY
  SELECT 
    v_links_created,
    v_processed_count,
    v_last_id,
    v_processed_count = p_limit;
END;
$$;