-- Create job tracking table for Code2ASIN imports
CREATE TABLE IF NOT EXISTS code2asin_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE code2asin_import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own jobs
CREATE POLICY "Users can view their own import jobs"
  ON code2asin_import_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage all jobs
CREATE POLICY "Service role can manage import jobs"
  ON code2asin_import_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for faster lookups by user and status
CREATE INDEX IF NOT EXISTS idx_code2asin_import_jobs_user_status 
  ON code2asin_import_jobs(user_id, status, created_at DESC);

-- Add realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE code2asin_import_jobs;

-- Performance indexes for product_analyses
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_ean 
  ON product_analyses(user_id, ean) 
  WHERE ean IS NOT NULL AND ean != '';

-- Unique index for code2asin_enrichments (for fast upserts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_code2asin_enrichments_analysis_id 
  ON code2asin_enrichments(analysis_id);

-- Index for listing enrichments by user and date
CREATE INDEX IF NOT EXISTS idx_code2asin_enrichments_user_created 
  ON code2asin_enrichments(user_id, created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_code2asin_import_jobs_updated_at
  BEFORE UPDATE ON code2asin_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();