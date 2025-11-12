-- Table pour les configurations de plateformes MCP
CREATE TABLE IF NOT EXISTS public.platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  credentials JSONB DEFAULT '{}',
  mcp_config JSONB DEFAULT '{}',
  mcp_allowed_tools TEXT[] DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform_type)
);

-- Table pour tracker l'usage et les coûts de Gemini RAG
CREATE TABLE IF NOT EXISTS public.gemini_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'query', 'sync'
  tokens_input INTEGER,
  tokens_output INTEGER,
  execution_time_ms INTEGER,
  cost_usd NUMERIC(10,6),
  question TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_platform_configurations_user_id ON public.platform_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_configurations_active ON public.platform_configurations(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gemini_usage_user_date ON public.gemini_usage_tracking(user_id, created_at DESC);

-- RLS pour platform_configurations
ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own platform configurations"
  ON public.platform_configurations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS pour gemini_usage_tracking
ALTER TABLE public.gemini_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Gemini usage"
  ON public.gemini_usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert Gemini usage"
  ON public.gemini_usage_tracking
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admins can view all Gemini usage"
  ON public.gemini_usage_tracking
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_platform_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_configurations_updated_at
  BEFORE UPDATE ON public.platform_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_configurations_updated_at();