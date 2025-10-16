-- Phase E.1: Remove problematic trigger that uses non-existent net.http_post()
-- Using CASCADE to drop dependent objects
DROP TRIGGER IF EXISTS auto_process_on_insert ON public.enrichment_queue CASCADE;
DROP FUNCTION IF EXISTS public.trigger_enrichment_processing() CASCADE;