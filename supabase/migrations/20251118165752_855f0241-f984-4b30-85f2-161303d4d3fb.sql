-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create automation logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  result_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RLS policies for automation_logs
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automation logs"
  ON automation_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Create function wrapper for cron job
CREATE OR REPLACE FUNCTION auto_sync_supplier_links()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  result_record RECORD;
BEGIN
  -- Loop through all active users
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM product_analyses 
    WHERE created_at > NOW() - INTERVAL '30 days'
  LOOP
    -- Execute sync for each user
    SELECT * INTO result_record
    FROM bulk_create_all_supplier_links_by_ean(user_record.user_id);
    
    -- Log the result
    INSERT INTO automation_logs (
      user_id, 
      action_type, 
      result_data, 
      created_at
    ) VALUES (
      user_record.user_id,
      'auto_sync_ean',
      jsonb_build_object(
        'links_created', result_record.links_created,
        'products_matched', result_record.products_matched,
        'execution_time_ms', result_record.execution_time_ms
      ),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule hourly execution
SELECT cron.schedule(
  'hourly-ean-sync',
  '0 * * * *',
  $$SELECT auto_sync_supplier_links()$$
);