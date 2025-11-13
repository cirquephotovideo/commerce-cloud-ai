-- Créer la table de suivi des suppressions en masse
CREATE TABLE IF NOT EXISTS public.bulk_deletion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_suppliers INTEGER NOT NULL,
  completed_suppliers INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  deleted_products INTEGER DEFAULT 0,
  current_supplier_id UUID,
  current_supplier_name TEXT,
  error_message TEXT,
  errors JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_bulk_deletion_jobs_user_id ON public.bulk_deletion_jobs(user_id);
CREATE INDEX idx_bulk_deletion_jobs_status ON public.bulk_deletion_jobs(status);

-- RLS policies
ALTER TABLE public.bulk_deletion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion jobs"
  ON public.bulk_deletion_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deletion jobs"
  ON public.bulk_deletion_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Activer la réplication en temps réel pour le suivi de progression
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_deletion_jobs;