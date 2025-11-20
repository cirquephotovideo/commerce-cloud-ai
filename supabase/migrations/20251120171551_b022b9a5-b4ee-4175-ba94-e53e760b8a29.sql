-- Fix null constraint violation in update_best_supplier_price
CREATE OR REPLACE FUNCTION public.update_best_supplier_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_best_price NUMERIC;
  v_best_supplier_id UUID;
BEGIN
  -- Find best price and supplier
  SELECT 
    MIN(purchase_price),
    (SELECT supplier_id
     FROM supplier_price_variants spv2
     WHERE spv2.analysis_id = NEW.analysis_id
       AND spv2.stock_quantity > 0
       AND spv2.purchase_price > 0
     ORDER BY spv2.purchase_price ASC
     LIMIT 1)
  INTO v_best_price, v_best_supplier_id
  FROM supplier_price_variants spv
  WHERE spv.analysis_id = NEW.analysis_id
    AND spv.stock_quantity > 0
    AND spv.purchase_price > 0;
  
  -- Only update if we have valid data
  IF v_best_price IS NOT NULL AND v_best_supplier_id IS NOT NULL THEN
    UPDATE product_analyses pa
    SET 
      analysis_result = jsonb_set(
        jsonb_set(
          COALESCE(pa.analysis_result, '{}'::jsonb),
          '{best_supplier_price}',
          to_jsonb(v_best_price)
        ),
        '{best_supplier_id}',
        to_jsonb(v_best_supplier_id::text)
      )
    WHERE pa.id = NEW.analysis_id;
  END IF;
  
  RETURN NEW;
END;
$function$;