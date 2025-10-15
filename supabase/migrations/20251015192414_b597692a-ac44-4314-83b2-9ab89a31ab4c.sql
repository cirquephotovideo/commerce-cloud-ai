-- Phase 7: Automation & Dashboard Tables

-- Table pour les schedules d'import
CREATE TABLE IF NOT EXISTS public.import_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  schedule_name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('email', 'ftp', 'api')),
  frequency TEXT NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
  cron_expression TEXT,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les règles d'automatisation
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('price_update', 'auto_link', 'alert', 'stock_alert')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour les templates de mapping
CREATE TABLE IF NOT EXISTS public.mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  template_name TEXT NOT NULL,
  description TEXT,
  mapping_config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_name)
);

-- Vue pour les statistiques d'import
CREATE OR REPLACE VIEW public.import_statistics AS
SELECT 
  DATE_TRUNC('day', created_at) as import_date,
  user_id,
  supplier_id,
  COUNT(*) as total_imports,
  COUNT(*) FILTER (WHERE status = 'processed') as success_count,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  AVG(CASE WHEN products_found > 0 THEN products_found ELSE NULL END) as avg_products_per_import,
  SUM(products_created) as total_products_created,
  SUM(products_updated) as total_products_updated
FROM public.email_inbox
WHERE status IN ('processed', 'error')
GROUP BY import_date, user_id, supplier_id;

-- Enable RLS
ALTER TABLE public.import_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour import_schedules
CREATE POLICY "Users can manage their own schedules"
ON public.import_schedules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies pour automation_rules
CREATE POLICY "Users can manage their own rules"
ON public.automation_rules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies pour mapping_templates
CREATE POLICY "Users can manage their own templates"
ON public.mapping_templates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_import_schedules_updated_at
BEFORE UPDATE ON public.import_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mapping_templates_updated_at
BEFORE UPDATE ON public.mapping_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour performance
CREATE INDEX idx_import_schedules_user_active ON public.import_schedules(user_id, is_active);
CREATE INDEX idx_import_schedules_next_run ON public.import_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_automation_rules_user_active ON public.automation_rules(user_id, is_active);
CREATE INDEX idx_mapping_templates_user ON public.mapping_templates(user_id);