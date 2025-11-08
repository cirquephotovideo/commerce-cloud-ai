-- Create import_logs table for real-time logging
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  supplier_id UUID,
  function_name TEXT,
  step TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Create indexes for efficient queries
CREATE INDEX idx_import_logs_job_id ON public.import_logs(job_id);
CREATE INDEX idx_import_logs_job_created ON public.import_logs(job_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for their own jobs
CREATE POLICY "Users can view their own import logs"
  ON public.import_logs
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.import_jobs WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert logs for their own jobs (optional for UI)
CREATE POLICY "Users can insert their own import logs"
  ON public.import_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND job_id IN (
      SELECT id FROM public.import_jobs WHERE user_id = auth.uid()
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_logs;