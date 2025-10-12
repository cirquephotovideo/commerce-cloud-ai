-- Phase 6: Créer un cron job pour traiter automatiquement la queue d'enrichissement
-- Ce job s'exécutera toutes les 2 minutes pour traiter les tâches en attente

-- S'assurer que pg_cron et pg_net sont activés (déjà fait normalement)
SELECT cron.schedule(
  'auto-process-enrichment-queue',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-enrichment-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
        body:='{"maxItems": 5}'::jsonb
    ) as request_id;
  $$
);

-- Ajouter une table pour tracker le statut du cron job si besoin
CREATE TABLE IF NOT EXISTS public.enrichment_queue_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_run_at timestamp with time zone DEFAULT now(),
  tasks_processed integer DEFAULT 0,
  tasks_succeeded integer DEFAULT 0,
  tasks_failed integer DEFAULT 0,
  queue_status text DEFAULT 'active', -- active, slow, blocked
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrichment_queue_health ENABLE ROW LEVEL SECURITY;

-- Policy pour que seul le système puisse écrire
CREATE POLICY "System can manage queue health"
  ON public.enrichment_queue_health
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy pour que les admins puissent voir
CREATE POLICY "Admins can view queue health"
  ON public.enrichment_queue_health
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));
