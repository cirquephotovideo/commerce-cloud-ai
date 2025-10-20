-- Phase 1.1: Nettoyer les emails bloqués en processing
UPDATE email_inbox 
SET 
  status = 'pending',
  processed_at = NULL,
  processing_logs = COALESCE(processing_logs, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'timestamp', NOW(),
      'message', 'Reset manuel - emails bloqués détectés et réinitialisés'
    )
  )
WHERE status = 'processing' 
AND processed_at IS NULL;

-- Phase 1.2: Supprimer les jobs dupliqués, garder uniquement le plus récent par fournisseur
WITH ranked_jobs AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY supplier_id ORDER BY started_at DESC) as rn
  FROM import_jobs
  WHERE status = 'pending'
)
DELETE FROM import_jobs
WHERE id IN (
  SELECT id FROM ranked_jobs WHERE rn > 1
);

-- Réinitialiser le job restant en queued
UPDATE import_jobs
SET 
  status = 'queued',
  error_message = NULL,
  progress_current = 0
WHERE status = 'pending';

-- Phase 1.3: Créer le cron pour traiter les chunks d'import toutes les minutes
SELECT cron.schedule(
  'email-import-chunk-processor',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/email-import-chunk',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Créer aussi le cron pour retry-pending-import-jobs toutes les 5 minutes
SELECT cron.schedule(
  'retry-pending-import-jobs-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/retry-pending-import-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);