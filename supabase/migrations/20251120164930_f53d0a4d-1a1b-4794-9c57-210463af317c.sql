-- Fix: Remove analysis_result assignment from calculate_product_margin trigger
-- This trigger was causing "multiple assignments to same column" errors

DROP TRIGGER IF EXISTS calculate_product_margin ON product_analyses;

CREATE OR REPLACE FUNCTION public.calculate_product_margin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  selling_price NUMERIC;
BEGIN
  -- Extract selling price from analysis_result
  IF NEW.analysis_result IS NOT NULL THEN
    selling_price := COALESCE(
      (NEW.analysis_result->>'price')::numeric,
      (NEW.analysis_result->>'selling_price')::numeric,
      (NEW.analysis_result->>'recommended_price')::numeric
    );
  END IF;

  -- Calculate margin percentage without modifying analysis_result
  -- Only set the dedicated margin_percentage column
  IF NEW.purchase_price IS NOT NULL 
     AND NEW.purchase_price > 0 
     AND selling_price IS NOT NULL 
     AND selling_price > 0 THEN
    NEW.margin_percentage := ROUND(
      ((selling_price - NEW.purchase_price) / NEW.purchase_price) * 100,
      2
    );
  ELSE
    NEW.margin_percentage := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER calculate_product_margin
  BEFORE INSERT OR UPDATE ON product_analyses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_margin();