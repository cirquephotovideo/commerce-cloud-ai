-- =====================================================
-- PHASE 1: Sécurisation des données sensibles
-- =====================================================

-- 1.1: Supprimer la politique trop permissive sur subscription_plans
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.subscription_plans;

-- 1.2: Créer une vue publique stricte pour les plans d'abonnement
DROP VIEW IF EXISTS public.public_subscription_plans;

CREATE VIEW public.public_subscription_plans AS
SELECT 
  id,
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  display_order,
  jsonb_build_object(
    'products_limit', COALESCE((limits->>'product_analyses')::int, -1),
    'searches_limit', COALESCE((limits->>'google_shopping_searches')::int, -1),
    'unlimited', (limits->>'product_analyses')::int = -1
  ) as plan_features
FROM public.subscription_plans
WHERE is_active = true
ORDER BY display_order;

-- 1.3: Autoriser l'accès public à la vue uniquement
GRANT SELECT ON public.public_subscription_plans TO anon, authenticated;

-- 1.4: Permettre aux utilisateurs authentifiés de voir LEUR plan actuel complet
DROP POLICY IF EXISTS "Users can view their active subscription plan details" ON public.subscription_plans;
CREATE POLICY "Users can view their active subscription plan details"
ON public.subscription_plans FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT plan_id 
    FROM public.user_subscriptions 
    WHERE user_id = auth.uid() AND status IN ('active', 'trialing')
  )
);

-- =====================================================
-- PHASE 2: Politique DELETE manquante sur api_keys
-- =====================================================

DROP POLICY IF EXISTS "Users can only delete their own API keys" ON public.api_keys;
CREATE POLICY "Users can only delete their own API keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =====================================================
-- PHASE 3: Correction des fonctions SECURITY DEFINER
-- =====================================================

CREATE OR REPLACE FUNCTION public.encrypt_email_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(
      plain_password,
      current_setting('app.jwt_secret', true)
    ),
    'base64'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_email_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_password, 'base64'),
    current_setting('app.jwt_secret', true)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_supplier_password(p_supplier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE supplier_configurations
  SET connection_config = jsonb_set(
    connection_config,
    '{imap_password}',
    to_jsonb(encrypt_email_password(connection_config->>'imap_password'))
  )
  WHERE id = p_supplier_id
  AND connection_config->>'imap_password' IS NOT NULL
  AND length(connection_config->>'imap_password') < 50;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_product_margin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.track_supplier_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.notify_supplier_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.track_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.current_price IS DISTINCT FROM OLD.current_price THEN
    INSERT INTO price_history (price_monitoring_id, user_id, price, stock_status, source)
    VALUES (NEW.id, NEW.user_id, NEW.current_price, NEW.stock_status, NEW.search_engine);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  starter_plan_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  SELECT id INTO starter_plan_id
  FROM public.subscription_plans
  WHERE name = 'Starter' AND is_active = true
  LIMIT 1;
  
  IF starter_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      status,
      billing_interval,
      trial_start,
      trial_end,
      current_period_start,
      current_period_end
    ) VALUES (
      NEW.id,
      starter_plan_id,
      'trialing',
      'monthly',
      NOW(),
      NOW() + INTERVAL '7 days',
      NOW(),
      NOW() + INTERVAL '7 days'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;