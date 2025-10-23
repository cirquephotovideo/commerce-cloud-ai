-- Enable pg_net extension for HTTP requests in database triggers and cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger enrichment processing automatically
CREATE OR REPLACE FUNCTION trigger_enrichment_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the edge function via pg_net when a new pending task is inserted
  PERFORM net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-enrichment-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I'
    ),
    body := jsonb_build_object('maxItems', 10, 'parallel', 3)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires on INSERT into enrichment_queue
DROP TRIGGER IF EXISTS on_enrichment_queue_insert ON enrichment_queue;
CREATE TRIGGER on_enrichment_queue_insert
  AFTER INSERT ON enrichment_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_enrichment_processing();

-- Update the existing cron job to run every minute instead of every 5 minutes
SELECT cron.alter_job(
  6,
  schedule := '* * * * *',
  command := $$
    SELECT net.http_post(
      url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-enrichment-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I'
      ),
      body := jsonb_build_object('maxItems', 10, 'parallel', 5)
    ) as request_id
    WHERE EXISTS (
      SELECT 1 FROM enrichment_queue 
      WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '2 minutes'
    );
  $$
);

-- Reset stuck tasks to allow retry
UPDATE enrichment_queue
SET retry_count = 0,
    updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';