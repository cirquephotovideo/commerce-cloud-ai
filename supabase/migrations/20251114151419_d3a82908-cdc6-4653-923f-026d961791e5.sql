-- Performance indexes for Amazon auto-linking
-- 1) Composite and partial indexes on normalized_ean
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_ean
  ON public.product_analyses (user_id, normalized_ean)
  WHERE normalized_ean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_user_ean
  ON public.supplier_products (user_id, normalized_ean)
  WHERE normalized_ean IS NOT NULL;

-- 2) Ensure fast pagination per user
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_id
  ON public.product_analyses (user_id, id);

-- 3) Ensure uniqueness constraint exists for conflict handling
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_links_analysis_supplier
  ON public.product_links (analysis_id, supplier_product_id);

-- New cursor-based function to avoid OFFSET scans and enable efficient iteration
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
BEGIN
  SET LOCAL statement_timeout = '120s';

  RETURN QUERY
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
    (SELECT COUNT(*)::INTEGER FROM inserted) as links_created,
    (SELECT COUNT(*)::INTEGER FROM batch_analyses) as processed_count,
    (SELECT MAX(id) FROM batch_analyses) as last_id,
    (SELECT COUNT(*)::INTEGER FROM batch_analyses) = p_limit as has_more;
END;
$$;