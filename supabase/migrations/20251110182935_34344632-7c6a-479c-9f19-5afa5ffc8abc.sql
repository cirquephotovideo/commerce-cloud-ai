-- Create code2asin_import_logs table to track all imports
CREATE TABLE code2asin_import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  import_duration_ms INTEGER,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX idx_code2asin_import_logs_user_id ON code2asin_import_logs(user_id);
CREATE INDEX idx_code2asin_import_logs_created_at ON code2asin_import_logs(created_at DESC);

-- Enable RLS
ALTER TABLE code2asin_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own import logs"
  ON code2asin_import_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import logs"
  ON code2asin_import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE code2asin_import_logs IS 'Tracks all Code2ASIN CSV import operations with detailed statistics';