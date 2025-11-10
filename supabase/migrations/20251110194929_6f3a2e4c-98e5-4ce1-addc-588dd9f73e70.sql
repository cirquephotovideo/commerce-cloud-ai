-- Créer la table de suivi des exports Code2ASIN
CREATE TABLE code2asin_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  
  progress_current INT DEFAULT 0,
  progress_total INT DEFAULT 0,
  products_exported INT DEFAULT 0,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  file_url TEXT,
  file_name TEXT,
  error_message TEXT,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_code2asin_export_jobs_user ON code2asin_export_jobs(user_id);
CREATE INDEX idx_code2asin_export_jobs_status ON code2asin_export_jobs(status);

ALTER TABLE code2asin_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export jobs"
  ON code2asin_export_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own export jobs"
  ON code2asin_export_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE code2asin_export_jobs;

-- Créer le bucket Storage pour les exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- RLS pour le bucket exports
CREATE POLICY "Users can view their exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = 'code2asin_exports'
  );

CREATE POLICY "Service role can manage exports"
  ON storage.objects FOR ALL
  USING (bucket_id = 'exports')
  WITH CHECK (bucket_id = 'exports');