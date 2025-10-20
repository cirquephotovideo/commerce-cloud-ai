-- Phase 1: Création de la table automation_master_rules
CREATE TABLE IF NOT EXISTS automation_master_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identité de la règle
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_category TEXT NOT NULL CHECK (rule_category IN ('import', 'cleanup', 'enrichment', 'export', 'sync', 'linking')),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Déclencheurs (triggers)
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('schedule', 'event', 'webhook', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  
  -- Conditions d'exécution
  conditions JSONB DEFAULT '{}',
  
  -- Sources de données
  source_config JSONB NOT NULL DEFAULT '{}',
  
  -- Actions à effectuer
  actions JSONB NOT NULL DEFAULT '[]',
  
  -- Gestion des erreurs
  retry_config JSONB DEFAULT '{"max_retries": 3, "retry_delay_minutes": 5}',
  on_error_action TEXT DEFAULT 'log' CHECK (on_error_action IN ('log', 'alert', 'stop', 'continue')),
  
  -- Statistiques
  trigger_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  
  -- Nettoyage automatique
  cleanup_after_days INTEGER,
  archive_results BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_automation_master_user ON automation_master_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_master_active ON automation_master_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_master_category ON automation_master_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_automation_master_next_run ON automation_master_rules(last_triggered_at);

-- RLS policies
ALTER TABLE automation_master_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own automation rules"
  ON automation_master_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automation rules"
  ON automation_master_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation rules"
  ON automation_master_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation rules"
  ON automation_master_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_automation_master_rules_updated_at
  BEFORE UPDATE ON automation_master_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Phase 2: Table automation_webhooks
CREATE TABLE IF NOT EXISTS automation_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_name TEXT NOT NULL,
  webhook_url TEXT UNIQUE NOT NULL,
  automation_rule_id UUID REFERENCES automation_master_rules(id) ON DELETE CASCADE,
  secret_token TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_webhooks_user ON automation_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_webhooks_active ON automation_webhooks(is_active);

ALTER TABLE automation_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhooks"
  ON automation_webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks"
  ON automation_webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks"
  ON automation_webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks"
  ON automation_webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 3: Table automation_notifications
CREATE TABLE IF NOT EXISTS automation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_master_rules(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'slack', 'webhook', 'in_app')),
  config JSONB NOT NULL DEFAULT '{}',
  trigger_conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_notifications_user ON automation_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_notifications_rule ON automation_notifications(rule_id);

ALTER TABLE automation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON automation_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notifications"
  ON automation_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON automation_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON automation_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Phase 4: Fonction helper pour vérifier si une règle doit être exécutée
CREATE OR REPLACE FUNCTION should_execute_automation_rule(
  p_rule_id UUID,
  p_trigger_config JSONB,
  p_last_triggered_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  frequency TEXT;
  frequency_minutes INTEGER;
BEGIN
  frequency := p_trigger_config->>'frequency';
  
  -- Si jamais exécuté, retourner true
  IF p_last_triggered_at IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Calculer le délai en minutes selon la fréquence
  CASE frequency
    WHEN 'every_minute' THEN frequency_minutes := 1;
    WHEN 'every_5_minutes' THEN frequency_minutes := 5;
    WHEN 'every_15_minutes' THEN frequency_minutes := 15;
    WHEN 'every_30_minutes' THEN frequency_minutes := 30;
    WHEN 'hourly' THEN frequency_minutes := 60;
    WHEN 'every_2_hours' THEN frequency_minutes := 120;
    WHEN 'every_6_hours' THEN frequency_minutes := 360;
    WHEN 'daily' THEN frequency_minutes := 1440;
    WHEN 'weekly' THEN frequency_minutes := 10080;
    ELSE frequency_minutes := 60; -- Par défaut: 1 heure
  END CASE;
  
  -- Vérifier si assez de temps s'est écoulé
  RETURN (NOW() - p_last_triggered_at) >= (frequency_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Phase 5: Cron jobs
-- Orchestrateur principal (toutes les 5 minutes)
SELECT cron.schedule(
  'automation-master-orchestrator',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/automation-master-orchestrator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Nettoyage des emails bloqués (toutes les 15 minutes)
SELECT cron.schedule(
  'cleanup-stuck-emails-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/cleanup-stuck-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb
  ) as request_id;
  $$
);

-- Nettoyage des anciens emails (quotidien à 3h du matin)
SELECT cron.schedule(
  'cleanup-old-emails-cron',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/cleanup-old-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb
  ) as request_id;
  $$
);

-- Traitement des enrichissements en attente (toutes les 2 minutes)
SELECT cron.schedule(
  'process-pending-enrichments-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/process-pending-enrichments',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb
  ) as request_id;
  $$
);