-- Create ai_provider_configs table for unified AI provider management
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('lovable', 'claude', 'openai', 'openrouter', 'ollama_cloud', 'ollama_local')),
  api_key_encrypted TEXT,
  api_url TEXT,
  default_model TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider)
);

-- Enable RLS
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admins can manage AI provider configs"
ON public.ai_provider_configs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index for active providers
CREATE INDEX idx_ai_provider_active ON public.ai_provider_configs(is_active, priority DESC);

-- Insert default configurations
INSERT INTO public.ai_provider_configs (provider, is_active, priority, default_model) VALUES
  ('lovable', true, 1, 'google/gemini-2.5-flash'),
  ('claude', false, 2, 'claude-sonnet-4-20250514'),
  ('openai', false, 3, 'gpt-5-mini'),
  ('openrouter', false, 4, 'anthropic/claude-3.5-sonnet'),
  ('ollama_cloud', false, 5, NULL),
  ('ollama_local', false, 6, NULL)
ON CONFLICT (provider) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_ai_provider_configs_updated_at
BEFORE UPDATE ON public.ai_provider_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();