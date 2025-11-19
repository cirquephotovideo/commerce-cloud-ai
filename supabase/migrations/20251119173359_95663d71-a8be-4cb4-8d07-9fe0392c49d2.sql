-- Create import_chunk_errors table
CREATE TABLE IF NOT EXISTS import_chunk_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES supplier_import_chunk_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE import_chunk_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chunk errors"
  ON import_chunk_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_import_chunk_jobs j
      WHERE j.id = import_chunk_errors.job_id
      AND j.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert chunk errors"
  ON import_chunk_errors FOR INSERT
  WITH CHECK (true);

-- Add retry_count column to supplier_import_chunk_jobs if not exists
ALTER TABLE supplier_import_chunk_jobs 
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Function to detect and mark stuck import jobs
CREATE OR REPLACE FUNCTION check_stuck_import_jobs()
RETURNS void AS $$
BEGIN
  UPDATE supplier_import_chunk_jobs
  SET status = 'stalled',
      error_message = 'Import bloqué - reprise nécessaire'
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;