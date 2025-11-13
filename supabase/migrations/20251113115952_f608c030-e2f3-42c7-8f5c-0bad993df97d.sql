-- Table pour suivre les chunks d'import Code2ASIN
CREATE TABLE IF NOT EXISTS public.code2asin_import_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.code2asin_import_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_row INTEGER NOT NULL,
  end_row INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_rows INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, chunk_index)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_code2asin_chunks_job_id ON public.code2asin_import_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_code2asin_chunks_status ON public.code2asin_import_chunks(status);

-- RLS policies
ALTER TABLE public.code2asin_import_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import chunks"
  ON public.code2asin_import_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.code2asin_import_jobs j
      WHERE j.id = code2asin_import_chunks.job_id
      AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all chunks"
  ON public.code2asin_import_chunks
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_code2asin_chunks_updated_at
  BEFORE UPDATE ON public.code2asin_import_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();