-- 1. Assigner le rôle super_admin à l'utilisateur actuel
INSERT INTO user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'alexistu2005@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Ajouter une politique RLS pour les admins sur user_subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON user_subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Modifier le trigger pour assigner automatiquement le rôle 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  starter_plan_id UUID;
BEGIN
  -- Créer le profil utilisateur
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assigner automatiquement le rôle 'user'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Récupérer l'ID du plan Starter
  SELECT id INTO starter_plan_id
  FROM public.subscription_plans
  WHERE name = 'Starter' AND is_active = true
  LIMIT 1;
  
  -- Activer automatiquement l'essai gratuit de 7 jours
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
$$;

-- 4. Assigner le rôle 'user' à tous les utilisateurs existants qui n'ont pas de rôle
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;