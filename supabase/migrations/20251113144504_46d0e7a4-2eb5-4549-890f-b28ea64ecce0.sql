-- Create table for tracking bulk product deletion jobs
CREATE TABLE IF NOT EXISTS bulk_product_deletion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_ids TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_products INTEGER NOT NULL,
  deleted_products INTEGER DEFAULT 0,
  deleted_links INTEGER DEFAULT 0,
  deleted_variants INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for performance
CREATE INDEX idx_bulk_product_deletion_jobs_user_id ON bulk_product_deletion_jobs(user_id);
CREATE INDEX idx_bulk_product_deletion_jobs_status ON bulk_product_deletion_jobs(status);

-- RLS policies
ALTER TABLE bulk_product_deletion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own product deletion jobs"
  ON bulk_product_deletion_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product deletion jobs"
  ON bulk_product_deletion_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE bulk_product_deletion_jobs;