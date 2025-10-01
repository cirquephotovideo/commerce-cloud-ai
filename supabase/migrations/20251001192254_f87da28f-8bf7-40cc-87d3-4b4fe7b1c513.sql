-- Table pour la configuration Ollama
CREATE TABLE IF NOT EXISTS public.ollama_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ollama_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  available_models JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les permissions de fonctionnalités
CREATE TABLE IF NOT EXISTS public.feature_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  enabled_for_users BOOLEAN DEFAULT true,
  enabled_for_admins BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(feature_name)
);

-- Table pour les préférences IA de l'utilisateur
CREATE TABLE IF NOT EXISTS public.user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_provider TEXT DEFAULT 'lovable' CHECK (preferred_provider IN ('lovable', 'ollama')),
  fallback_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.ollama_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour ollama_configurations
CREATE POLICY "Users can manage their own Ollama config"
  ON public.ollama_configurations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all Ollama configs"
  ON public.ollama_configurations
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies pour feature_permissions
CREATE POLICY "Everyone can view feature permissions"
  ON public.feature_permissions
  FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage feature permissions"
  ON public.feature_permissions
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies pour user_ai_preferences
CREATE POLICY "Users can manage their own AI preferences"
  ON public.user_ai_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert des permissions par défaut
INSERT INTO public.feature_permissions (feature_name, feature_description, enabled_for_users, enabled_for_admins)
VALUES 
  ('product_analysis', 'Analyse complète de produits', true, true),
  ('technical_analysis', 'Analyse technique et compatibilité', true, true),
  ('risk_analysis', 'Évaluation des risques et conformité', true, true),
  ('market_intelligence', 'Intelligence de marché et concurrence', false, true),
  ('batch_export', 'Export en lot vers plateformes', false, true),
  ('single_export', 'Export individuel de produits', true, true),
  ('ean_search', 'Recherche par code EAN/barcode', true, true),
  ('ollama_ai', 'Utilisation de Ollama AI local', false, true)
ON CONFLICT (feature_name) DO NOTHING;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ollama_configurations_updated_at
  BEFORE UPDATE ON public.ollama_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_permissions_updated_at
  BEFORE UPDATE ON public.feature_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_preferences_updated_at
  BEFORE UPDATE ON public.user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();