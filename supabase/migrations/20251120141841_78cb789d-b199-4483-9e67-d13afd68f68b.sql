
-- Fix sync_supplier_price_variant trigger to use correct column names
CREATE OR REPLACE FUNCTION public.sync_supplier_price_variant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insérer ou mettre à jour supplier_price_variants à partir des données de supplier_products
  INSERT INTO supplier_price_variants (
    analysis_id,
    supplier_id,
    supplier_product_id,
    purchase_price,
    stock_quantity,
    currency,
    user_id,
    last_updated
  )
  SELECT 
    NEW.analysis_id,
    sp.supplier_id,
    sp.id,
    sp.purchase_price,
    sp.stock_quantity,
    'EUR',
    NEW.user_id,
    NOW()
  FROM supplier_products sp
  WHERE sp.id = NEW.supplier_product_id
  ON CONFLICT (analysis_id, supplier_product_id) 
  DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    stock_quantity = EXCLUDED.stock_quantity,
    last_updated = NOW();
  
  RETURN NEW;
END;
$function$;

-- Create function to clean duplicate product analyses by EAN
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
BEGIN
  -- Find and merge duplicate analyses for the same EAN
  FOR duplicate_record IN 
    SELECT 
      ean,
      array_agg(id ORDER BY created_at DESC) as analysis_ids
    FROM product_analyses
    WHERE user_id = p_user_id
      AND ean IS NOT NULL
      AND ean != ''
    GROUP BY ean
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent analysis (first in array)
    primary_analysis_id := duplicate_record.analysis_ids[1];
    
    -- Move product_links (delete conflicts first)
    DELETE FROM product_links
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    AND supplier_product_id IN (
      SELECT supplier_product_id FROM product_links WHERE analysis_id = primary_analysis_id
    );
    
    UPDATE product_links
    SET analysis_id = primary_analysis_id
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:]);
    
    -- Move product_amazon_links (delete conflicts first)
    DELETE FROM product_amazon_links
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    AND enrichment_id IN (
      SELECT enrichment_id FROM product_amazon_links WHERE analysis_id = primary_analysis_id
    );
    
    UPDATE product_amazon_links
    SET analysis_id = primary_analysis_id
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:]);
    
    -- Move supplier_price_variants (delete conflicts first)
    DELETE FROM supplier_price_variants
    WHERE analysis_id = ANY(duplicate_record.analysis_ids[2:])
    AND supplier_product_id IN (
      SELECT supplier_product_id FROM supplier_price_variants WHERE analysis_id = primary_analysis_id
    );
    
    UPDATE supplier_price_variants
    SET analysis_id = primary_analysis_id
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
