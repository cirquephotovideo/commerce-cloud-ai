-- Fix confidence_score format: use 1.0 instead of 100
-- The CHECK constraint expects values between 0 and 1 (decimal format)

CREATE OR REPLACE FUNCTION public.bulk_create_product_links(p_user_id uuid)
 RETURNS TABLE(links_created integer, execution_time_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  start_time TIMESTAMP;
  inserted_count INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  -- Insertion batch avec gestion des conflits
  WITH inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT 
      pa.id,
      sp.id,
      'auto',
      1.0,  -- Changed from 100 to 1.0 (decimal format 0-1)
      p_user_id
    FROM product_analyses pa
    INNER JOIN supplier_products sp 
      ON LOWER(TRIM(pa.ean)) = LOWER(TRIM(sp.ean))
    WHERE pa.user_id = p_user_id
      AND sp.user_id = p_user_id
      AND pa.ean IS NOT NULL 
      AND pa.ean != ''
      AND sp.ean IS NOT NULL
      AND sp.ean != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_links pl
        WHERE pl.analysis_id = pa.id 
          AND pl.supplier_product_id = sp.id
      )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT COUNT(*)::INTEGER INTO inserted_count FROM inserted;
  
  RETURN QUERY SELECT 
    inserted_count,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
END;
$function$;