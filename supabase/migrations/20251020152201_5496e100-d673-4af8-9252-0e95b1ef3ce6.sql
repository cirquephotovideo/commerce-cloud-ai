-- Supprimer l'ancien cron de 5 minutes
SELECT cron.unschedule('retry-pending-import-jobs');

-- Créer un nouveau cron qui lance retry-pending-import-jobs toutes les 2 minutes
SELECT cron.schedule(
  'retry-pending-import-jobs',
  '*/2 * * * *', -- Toutes les 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/retry-pending-import-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb
  ) as request_id;
  $$
);