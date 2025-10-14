-- Créer la fonction pour déclencher automatiquement le traitement de la queue
CREATE OR REPLACE FUNCTION public.trigger_enrichment_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Appeler l'edge function via pg_net pour traiter immédiatement
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger qui s'exécute après insertion dans enrichment_queue
DROP TRIGGER IF EXISTS auto_process_on_insert ON public.enrichment_queue;
CREATE TRIGGER auto_process_on_insert
AFTER INSERT ON public.enrichment_queue
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_enrichment_processing();

-- Supprimer le cron job obsolète qui appelle une fonction inexistante
SELECT cron.unschedule('auto-enrich-pending-products');

-- Réduire la fréquence du cron principal car le trigger gère le temps réel
SELECT cron.unschedule('auto-process-enrichment-queue');

SELECT cron.schedule(
  'auto-process-enrichment-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-enrichment-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
    body := '{"maxItems": 10, "parallel": 3}'::jsonb
  ) as request_id;
  $$
);