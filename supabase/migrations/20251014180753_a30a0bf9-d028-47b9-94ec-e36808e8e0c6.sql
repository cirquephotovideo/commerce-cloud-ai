-- ============================================
-- CORRECTION PROBLÈMES ERROR DE SÉCURITÉ
-- ============================================

-- 1. RESTREINDRE L'ACCÈS À subscription_plans (CRITIQUE)
-- Supprimer la politique trop permissive
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.subscription_plans;

-- Créer une vue publique stricte pour la page pricing (sans IDs Stripe sensibles)
CREATE OR REPLACE VIEW public.public_subscription_plans AS
SELECT 
  id,
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  display_order,
  -- Convertir limits en format marketing (ne pas exposer la structure interne)
  jsonb_build_object(
    'max_products', COALESCE((limits->>'product_analyses')::int, -1),
    'max_searches', COALESCE((limits->>'google_shopping_searches')::int, -1)
  ) as features_summary
FROM public.subscription_plans
WHERE is_active = true
ORDER BY display_order;

-- Autoriser l'accès public à la vue uniquement
GRANT SELECT ON public.public_subscription_plans TO anon, authenticated;

-- Politique restrictive sur la table complète (super admins seulement)
CREATE POLICY "Super admins can view all plan details"
ON public.subscription_plans FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Permettre aux utilisateurs authentifiés de voir LEUR plan actuel complet
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

-- 2. AJOUTER POLITIQUE DELETE SUR api_keys (CRITIQUE)
CREATE POLICY "Users can delete their own API keys"
ON public.api_keys FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 3. POLITIQUES EXPLICITES DE DENY SUR user_subscriptions (DÉFENSE EN PROFONDEUR)
CREATE POLICY "Users cannot modify subscriptions directly"
ON public.user_subscriptions FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Users cannot create subscriptions directly"
ON public.user_subscriptions FOR INSERT
TO authenticated
WITH CHECK (false);