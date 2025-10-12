-- Create user_alerts table (drop and recreate to be sure)
DROP TABLE IF EXISTS user_alerts CASCADE;

CREATE TABLE user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own alerts"
ON user_alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON user_alerts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can create alerts"
ON user_alerts FOR INSERT
WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_user_alerts_user_unread ON user_alerts(user_id, is_read, created_at DESC);

-- Create cron jobs (skip if already exist using DO block)
DO $$
BEGIN
  -- Try to unschedule, ignore if doesn't exist
  BEGIN
    PERFORM cron.unschedule('check-amazon-credentials-daily');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  BEGIN
    PERFORM cron.unschedule('check-enrichment-queue-hourly');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
END $$;

-- Schedule cron jobs
SELECT cron.schedule(
  'check-amazon-credentials-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/check-amazon-credentials-expiry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'check-enrichment-queue-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/check-enrichment-queue-stuck',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);