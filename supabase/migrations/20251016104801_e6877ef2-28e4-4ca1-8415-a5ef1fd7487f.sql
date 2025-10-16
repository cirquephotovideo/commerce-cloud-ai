-- Phase 5: Table de politiques de rétention des emails
CREATE TABLE IF NOT EXISTS public.email_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_delete_after_days INTEGER DEFAULT 30,
  archive_successful BOOLEAN DEFAULT true,
  keep_failed_permanently BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE public.email_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own retention policies"
  ON public.email_retention_policies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own retention policies"
  ON public.email_retention_policies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own retention policies"
  ON public.email_retention_policies FOR UPDATE
  USING (auth.uid() = user_id);

-- Index pour les requêtes
CREATE INDEX IF NOT EXISTS idx_email_retention_policies_user_id 
  ON public.email_retention_policies(user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_email_retention_policies_updated_at
  BEFORE UPDATE ON public.email_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();