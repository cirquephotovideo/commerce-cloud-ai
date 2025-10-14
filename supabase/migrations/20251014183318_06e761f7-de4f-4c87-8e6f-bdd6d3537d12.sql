-- Fonction pour obtenir l'email de l'utilisateur connecté de manière sécurisée
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = _user_id;
$$;

-- Recréer les policies de newsletter_subscribers avec la fonction sécurisée
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.newsletter_subscribers;
CREATE POLICY "Users can view their own subscription"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (email = public.get_user_email(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own subscription" ON public.newsletter_subscribers;
CREATE POLICY "Users can update their own subscription"
ON public.newsletter_subscribers
FOR UPDATE
TO authenticated
USING (email = public.get_user_email(auth.uid()))
WITH CHECK (email = public.get_user_email(auth.uid()));