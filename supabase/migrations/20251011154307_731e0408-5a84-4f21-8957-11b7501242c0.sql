-- Créer la table import_jobs pour suivre tous les imports
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress_current INT DEFAULT 0,
  progress_total INT DEFAULT 0,
  products_imported INT DEFAULT 0,
  products_matched INT DEFAULT 0,
  products_errors INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_import_jobs_supplier ON import_jobs(supplier_id);
CREATE INDEX idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);

-- RLS Policies
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update import jobs"
  ON import_jobs FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE import_jobs;

-- Trigger pour updated_at
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();