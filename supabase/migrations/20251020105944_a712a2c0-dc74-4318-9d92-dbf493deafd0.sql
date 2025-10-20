-- Fix 1: Add SELECT policy for user_roles table
-- This allows users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Update functions to have fixed search_path
-- Update calculate_product_margin trigger function
CREATE OR REPLACE FUNCTION public.calculate_product_margin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  selling_price NUMERIC;
BEGIN
  IF NEW.analysis_result IS NOT NULL THEN
    selling_price := COALESCE(
      (NEW.analysis_result->>'price')::numeric,
      (NEW.analysis_result->>'selling_price')::numeric,
      (NEW.analysis_result->>'recommended_price')::numeric
    );
  END IF;

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
$function$;

-- Update track_supplier_price_change function
CREATE OR REPLACE FUNCTION public.track_supplier_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price THEN
    DECLARE
      variation_pct NUMERIC;
    BEGIN
      IF OLD.purchase_price > 0 THEN
        variation_pct := ROUND((NEW.purchase_price - OLD.purchase_price) / OLD.purchase_price * 100, 2);
      ELSE
        variation_pct := 100;
      END IF;
      
      NEW.price_history := COALESCE(OLD.price_history, '[]'::jsonb) || 
        jsonb_build_object(
          'date', NOW(),
          'old_price', OLD.purchase_price,
          'new_price', NEW.purchase_price,
          'variation_pct', variation_pct,
          'supplier_id', NEW.supplier_id
        );
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_supplier_price_change function
CREATE OR REPLACE FUNCTION public.notify_supplier_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  price_change_percentage NUMERIC;
  supplier_name TEXT;
BEGIN
  IF OLD.purchase_price > 0 THEN
    price_change_percentage := ABS((NEW.purchase_price - OLD.purchase_price) / OLD.purchase_price * 100);
  ELSE
    price_change_percentage := 100;
  END IF;

  IF price_change_percentage > 10 THEN
    SELECT name INTO supplier_name
    FROM supplier_configurations
    WHERE id = NEW.supplier_id;

    RAISE NOTICE 'Price change detected for product % from supplier %: % -> % (% percent change)',
      NEW.name, supplier_name, OLD.purchase_price, NEW.purchase_price, ROUND(price_change_percentage, 2);
  END IF;

  RETURN NEW;
END;
$function$;

-- Update track_price_change function
CREATE OR REPLACE FUNCTION public.track_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NEW.current_price IS DISTINCT FROM OLD.current_price THEN
    INSERT INTO price_history (price_monitoring_id, user_id, price, stock_status, source)
    VALUES (NEW.id, NEW.user_id, NEW.current_price, NEW.stock_status, NEW.search_engine);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update check_enrichment_timeouts function
CREATE OR REPLACE FUNCTION public.check_enrichment_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  UPDATE public.enrichment_queue
  SET 
    status = 'failed',
    error_message = 'Timeout: enrichissement bloqué depuis plus de 10 minutes',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE status = 'processing'
    AND started_at IS NOT NULL
    AND started_at < NOW() - INTERVAL '10 minutes';
    
  IF FOUND THEN
    INSERT INTO public.system_health_logs (
      test_type,
      component_name,
      status,
      test_result
    ) VALUES (
      'enrichment_timeout_cleanup',
      'enrichment_queue',
      'warning',
      jsonb_build_object(
        'cleaned_count', (SELECT COUNT(*) FROM public.enrichment_queue WHERE status = 'failed' AND error_message LIKE 'Timeout%'),
        'timestamp', NOW()
      )
    );
  END IF;
END;
$function$;