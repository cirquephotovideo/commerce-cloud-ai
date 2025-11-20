-- Fix multiple assignments to analysis_result in update_best_supplier_price
CREATE OR REPLACE FUNCTION public.update_best_supplier_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Mettre à jour automatiquement le best_price et best_supplier dans product_analyses
  UPDATE product_analyses pa
  SET 
    analysis_result = jsonb_set(
      jsonb_set(
        COALESCE(pa.analysis_result, '{}'::jsonb),
        '{best_supplier_price}',
        to_jsonb(
          (SELECT MIN(purchase_price) 
           FROM supplier_price_variants spv 
           WHERE spv.analysis_id = pa.id 
             AND spv.stock_quantity > 0)
        )
      ),
      '{best_supplier_id}',
      to_jsonb(
        (SELECT supplier_id::text
         FROM supplier_price_variants spv 
         WHERE spv.analysis_id = pa.id 
           AND spv.stock_quantity > 0
         ORDER BY purchase_price ASC
         LIMIT 1)
      )
    )
  WHERE pa.id = NEW.analysis_id;
  
  RETURN NEW;
END;
$function$;