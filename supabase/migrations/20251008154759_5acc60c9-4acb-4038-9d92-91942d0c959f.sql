-- Create ai_prompts table for managing AI prompts
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('system', 'user', 'analysis', 'extraction')),
  prompt_content TEXT NOT NULL,
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(function_name, prompt_key, version)
);

-- Enable RLS
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admins can manage prompts
CREATE POLICY "Super admins can manage all AI prompts"
ON public.ai_prompts
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_ai_prompts_function_key ON public.ai_prompts(function_name, prompt_key) WHERE is_active = true;

-- Trigger to update updated_at
CREATE TRIGGER update_ai_prompts_updated_at
BEFORE UPDATE ON public.ai_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default prompts from existing functions
INSERT INTO public.ai_prompts (function_name, prompt_key, prompt_type, prompt_content, model, temperature) VALUES
-- product-analyzer
('product-analyzer', 'system', 'system', 'Tu es un assistant IA spécialisé dans l''analyse de produits e-commerce. Tu fournis des analyses détaillées, précises et orientées business.', 'google/gemini-2.5-flash', 0.7),
('product-analyzer', 'main_analysis', 'analysis', 'Analyse ce produit et retourne un JSON avec les champs suivants: title, description_short, description_long, category, price_range, tags, seo_title, seo_description, competitive_advantages, target_audience, use_cases, technical_specs, images_suggestions', 'google/gemini-2.5-flash', 0.7),

-- advanced-product-analyzer
('advanced-product-analyzer', 'technical_analysis', 'analysis', 'Effectue une analyse technique approfondie du produit incluant: spécifications détaillées, compatibilité, obsolescence technologique, alternatives techniques, et recommandations d''optimisation.', 'google/gemini-2.5-flash', 0.7),
('advanced-product-analyzer', 'commercial_analysis', 'analysis', 'Analyse commerciale du produit: recommandations de marge, bundles possibles, prédiction de retour, stratégie de pricing, et opportunités de vente additionnelle.', 'google/gemini-2.5-flash', 0.7),
('advanced-product-analyzer', 'market_intelligence', 'analysis', 'Intelligence marché: analyse de la concurrence, positionnement prix, tendances du marché, et recommandations stratégiques.', 'google/gemini-2.5-flash', 0.7),
('advanced-product-analyzer', 'risk_assessment', 'analysis', 'Évaluation des risques: conformité réglementaire, analyse de garantie, score d''authenticité, niveau de risque global.', 'google/gemini-2.5-flash', 0.7),

-- ai-taxonomy-categorizer
('ai-taxonomy-categorizer', 'categorization', 'analysis', 'Catégorise ce produit dans la taxonomie appropriée (Google Shopping ou Amazon). Retourne le category_id, le chemin complet, et un score de confiance.', 'google/gemini-2.5-flash', 0.3),

-- google-shopping-scraper
('google-shopping-scraper', 'url_extraction', 'extraction', 'Extrait l''URL du produit depuis les résultats de recherche Google Shopping.', 'google/gemini-2.5-flash', 0.5),
('google-shopping-scraper', 'results_parsing', 'extraction', 'Parse les résultats Google Shopping et extrait: titre, prix, marchand, note, nombre d''avis, URL.', 'google/gemini-2.5-flash', 0.5),

-- generate-image
('generate-image', 'image_generation', 'user', 'Génère une image professionnelle de produit e-commerce pour: {product_name}. Style: fond blanc, éclairage professionnel, haute qualité.', 'google/gemini-2.5-flash-image-preview', 0.8),

-- ai-chat
('ai-chat', 'system', 'system', 'Tu es un assistant IA spécialisé dans l''e-commerce. Tu aides les utilisateurs à analyser des produits, comprendre les tendances du marché, et optimiser leur stratégie commerciale. Sois précis, professionnel et orienté business dans tes réponses.', 'google/gemini-2.5-flash', 0.7);