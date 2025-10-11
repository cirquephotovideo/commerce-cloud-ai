-- CRITICAL SECURITY FIX: Restrict public access to AI provider API keys
-- Problem: Anyone can read AI provider configs where user_id IS NULL, exposing API keys

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view their own AI provider configs" ON public.ai_provider_configs;

-- Create a more restrictive policy that only allows users to see their own configs
-- and prevents reading system-wide (NULL user_id) configs without authentication
CREATE POLICY "Users can view only their own AI provider configs"
ON public.ai_provider_configs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Super admins can still view all configs including system-wide ones
-- (This policy already exists but let's ensure it's correct)
DROP POLICY IF EXISTS "Super admins can manage AI provider configs" ON public.ai_provider_configs;

CREATE POLICY "Super admins can manage AI provider configs"
ON public.ai_provider_configs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));