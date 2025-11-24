-- ============================================================
-- Phase 2.1: Dead Letter Queue for Persistent Failures
-- ============================================================
-- Purpose: Isolate chunks that fail after max retries for manual analysis
-- Expected gain: +99% job completion rate (failed chunks don't block queue)
-- ============================================================

-- Create dead letter queue table
CREATE TABLE IF NOT EXISTS import_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  chunk_data JSONB NOT NULL,
  error_details JSONB,
  retry_count INT DEFAULT 0,
  max_retries_exceeded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dlq_job ON import_dead_letters(job_id);
CREATE INDEX IF NOT EXISTS idx_dlq_created ON import_dead_letters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved ON import_dead_letters(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE import_dead_letters ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own DLQ entries
CREATE POLICY "Users can view own DLQ entries"
  ON import_dead_letters
  FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM import_jobs WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can insert DLQ entries
CREATE POLICY "Service role can insert DLQ entries"
  ON import_dead_letters
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own DLQ entries (mark as resolved)
CREATE POLICY "Users can update own DLQ entries"
  ON import_dead_letters
  FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM import_jobs WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE import_dead_letters IS 'Stores import chunks that failed after max retries for manual investigation';
COMMENT ON COLUMN import_dead_letters.chunk_data IS 'Original chunk request data (offset, limit, correlation_id, etc.)';
COMMENT ON COLUMN import_dead_letters.error_details IS 'Error message and stack trace from final failure';