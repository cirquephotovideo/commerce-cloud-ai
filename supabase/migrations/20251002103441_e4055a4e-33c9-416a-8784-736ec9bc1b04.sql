
-- Modifier le trigger handle_new_user pour activer automatiquement l'essai gratuit de 7 jours
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Créer la table pour tracker les conversions essai -> abonnement payant
CREATE TABLE IF NOT EXISTS public.trial_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_start TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
  converted BOOLEAN DEFAULT FALSE,
  conversion_date TIMESTAMP WITH TIME ZONE,
  selected_plan_id UUID REFERENCES public.subscription_plans(id),
  billing_interval TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS sur trial_conversions
ALTER TABLE public.trial_conversions ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent tout voir
CREATE POLICY "Super admins can view all trial conversions"
ON public.trial_conversions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Les utilisateurs peuvent voir leurs propres conversions
CREATE POLICY "Users can view their own trial conversions"
ON public.trial_conversions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Le système peut insérer les conversions
CREATE POLICY "System can insert trial conversions"
ON public.trial_conversions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Le système peut mettre à jour les conversions
CREATE POLICY "System can update trial conversions"
ON public.trial_conversions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_trial_conversions_user_id ON public.trial_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_conversions_converted ON public.trial_conversions(converted);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end ON public.user_subscriptions(trial_end);
