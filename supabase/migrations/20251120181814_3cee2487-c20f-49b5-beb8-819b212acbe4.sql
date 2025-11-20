-- Limit work per call in merge_duplicate_analyses_by_ean to avoid timeouts
CREATE OR REPLACE FUNCTION public.merge_duplicate_analyses_by_ean(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  duplicate_record RECORD;
  primary_analysis_id uuid;
  merged_count integer := 0;
  deleted_count integer := 0;
  link_record RECORD;
BEGIN
  -- Process at most 200 duplicate EAN groups per call to stay under statement timeout
  FOR duplicate_record IN 
    WITH duplicates AS (
      SELECT 
        ean,
        array_agg(id ORDER BY created_at DESC) as analysis_ids,
        MIN(created_at) AS oldest_created_at
      FROM product_analyses
      WHERE user_id = p_user_id
        AND ean IS NOT NULL
        AND ean != ''
      GROUP BY ean
      HAVING COUNT(*) > 1
    )
    SELECT *
    FROM duplicates
    ORDER BY oldest_created_at
    LIMIT 200
  LOOP
    -- Keep the most recent analysis (first in array)
    primary_analysis_id := duplicate_record.analysis_ids[1];
    
    -- Move product_links one by one with duplicate handling
    FOR link_record IN 
      SELECT DISTINCT ON (supplier_product_id) *
      FROM product_links
      WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    LOOP
      BEGIN
        UPDATE product_links
        SET analysis_id = primary_analysis_id
        WHERE id = link_record.id
          AND NOT EXISTS (
            SELECT 1 FROM product_links 
            WHERE analysis_id = primary_analysis_id 
              AND supplier_product_id = link_record.supplier_product_id
          );
      EXCEPTION WHEN unique_violation THEN
        DELETE FROM product_links WHERE id = link_record.id;
      END;
    END LOOP;
    
    DELETE FROM product_links
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:]);
    
    -- Move product_amazon_links
    FOR link_record IN 
      SELECT DISTINCT ON (enrichment_id) *
      FROM product_amazon_links
      WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    LOOP
      BEGIN
        UPDATE product_amazon_links
        SET analysis_id = primary_analysis_id
        WHERE id = link_record.id
          AND NOT EXISTS (
            SELECT 1 FROM product_amazon_links 
            WHERE analysis_id = primary_analysis_id 
              AND enrichment_id = link_record.enrichment_id
          );
      EXCEPTION WHEN unique_violation THEN
        DELETE FROM product_amazon_links WHERE id = link_record.id;
      END;
    END LOOP;
    
    DELETE FROM product_amazon_links
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:]);
    
    -- Move supplier_price_variants
    FOR link_record IN 
      SELECT DISTINCT ON (supplier_product_id) *
      FROM supplier_price_variants
      WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    LOOP
      BEGIN
        UPDATE supplier_price_variants
        SET analysis_id = primary_analysis_id
        WHERE id = link_record.id
          AND NOT EXISTS (
            SELECT 1 FROM supplier_price_variants 
            WHERE analysis_id = primary_analysis_id 
              AND supplier_product_id = link_record.supplier_product_id
          );
      EXCEPTION WHEN unique_violation THEN
        DELETE FROM supplier_price_variants WHERE id = link_record.id;
      END;
    END LOOP;
    
    DELETE FROM supplier_price_variants
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:]);
    
    -- Delete duplicate analyses
    DELETE FROM product_analyses
    WHERE id = ANY(duplicate_record.analysis_ids[2:]);
    
    merged_count := merged_count + 1;
    deleted_count := deleted_count + (array_length(duplicate_record.analysis_ids, 1) - 1);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'merged_eans', merged_count,
    'deleted_analyses', deleted_count,
    'timestamp', NOW()
  );
END;
$function$;