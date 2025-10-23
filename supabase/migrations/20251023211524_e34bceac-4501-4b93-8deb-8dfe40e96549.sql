-- Safe rollback of enrichment auto-trigger/cron changes to fix build errors
-- Ensure required extensions exist (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop trigger and function if they exist (were introduced in previous migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_enrichment_queue_insert'
      AND n.nspname = 'public'
      AND c.relname = 'enrichment_queue'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_enrichment_queue_insert ON public.enrichment_queue';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'trigger_enrichment_processing'
  ) THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.trigger_enrichment_processing()';
  END IF;
END $$;

-- Do not alter existing cron jobs here to avoid errors when job IDs differ across environments
-- Frontend polling and manual invocation will continue to process the queue reliably.
