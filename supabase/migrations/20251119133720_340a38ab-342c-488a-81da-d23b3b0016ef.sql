-- Create table for chunked import jobs
CREATE TABLE IF NOT EXISTS public.supplier_import_chunk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  current_chunk INTEGER NOT NULL DEFAULT 0,
  chunk_size INTEGER NOT NULL DEFAULT 100,
  skip_rows INTEGER NOT NULL DEFAULT 1,
  column_mapping JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  matched INTEGER NOT NULL DEFAULT 0,
  new_products INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_supplier_chunk_jobs_status ON public.supplier_import_chunk_jobs(status);
CREATE INDEX IF NOT EXISTS idx_supplier_chunk_jobs_user ON public.supplier_import_chunk_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_chunk_jobs_supplier ON public.supplier_import_chunk_jobs(supplier_id);

-- Enable RLS
ALTER TABLE public.supplier_import_chunk_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own chunk jobs"
  ON public.supplier_import_chunk_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chunk jobs"
  ON public.supplier_import_chunk_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update chunk jobs"
  ON public.supplier_import_chunk_jobs
  FOR UPDATE
  USING (true);

-- Add comment
COMMENT ON TABLE public.supplier_import_chunk_jobs IS 'Tracks chunked imports for large supplier files';