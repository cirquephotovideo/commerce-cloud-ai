-- Create user_provider_preferences table
CREATE TABLE IF NOT EXISTS public.user_provider_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_provider TEXT NOT NULL DEFAULT 'lovable',
  fallback_order JSONB DEFAULT '["lovable", "claude", "openai", "openrouter", "ollama_cloud", "ollama_local"]'::jsonb,
  fallback_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_provider_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can manage their own provider preferences"
ON public.user_provider_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_provider_preferences_updated_at
BEFORE UPDATE ON public.user_provider_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();