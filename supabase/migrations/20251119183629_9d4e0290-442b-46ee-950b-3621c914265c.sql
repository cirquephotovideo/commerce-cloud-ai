-- Clean up stuck Amazon auto-link jobs
UPDATE amazon_auto_link_jobs
SET 
  status = 'failed',
  error_message = 'Job timeout - bloqué depuis plus de 24h. Relancez la fusion.',
  completed_at = NOW()
WHERE status IN ('pending', 'processing')
  AND (
    started_at IS NULL OR 
    started_at < NOW() - INTERVAL '24 hours'
  );

-- Optimize bulk_create_product_links_cursor: disable trigger during batch creation
CREATE OR REPLACE FUNCTION public.bulk_create_product_links_cursor(
  p_user_id uuid, 
  p_limit integer DEFAULT 100, 
  p_after uuid DEFAULT NULL
)
RETURNS TABLE(
  links_created integer, 
  processed_count integer, 
  last_id uuid, 
  has_more boolean
)
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_id uuid;
  v_processed_count integer;
  v_links_created integer;
BEGIN
  SET LOCAL statement_timeout = '30s';
  
  -- Disable triggers temporarily for performance
  SET session_replication_role = 'replica';
  
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
  
  -- Re-enable triggers
  SET session_replication_role = 'origin';

  RETURN QUERY
  SELECT 
    v_links_created,
    v_processed_count,
    v_last_id,
    v_processed_count = p_limit;
END;
$$;