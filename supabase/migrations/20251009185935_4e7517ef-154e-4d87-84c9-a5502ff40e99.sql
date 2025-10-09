-- Phase 4: Ajouter colonnes pour tracking export
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exported_to_platforms JSONB DEFAULT '[]'::jsonb;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_product_analyses_last_exported 
ON product_analyses(last_exported_at);

-- Phase 6: Activer la réplication temps réel pour supplier_products
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_products;

-- Phase 6: Cron Job pour enrichissement automatique (toutes les 10 minutes)
-- Note: Nécessite l'extension pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Créer un job cron pour déclencher l'enrichissement automatique
SELECT cron.schedule(
  'auto-enrich-pending-products',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-pending-enrichments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
  $$
);