-- Table pour stocker les sites concurrents configurés
CREATE TABLE public.competitor_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  site_name TEXT NOT NULL,
  site_url TEXT NOT NULL,
  site_type TEXT NOT NULL, -- 'amazon', 'fnac', 'darty', 'custom'
  is_active BOOLEAN DEFAULT true,
  scraping_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour l'historique des prix concurrents
CREATE TABLE public.price_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  competitor_site_id UUID REFERENCES public.competitor_sites(id) ON DELETE CASCADE,
  current_price DECIMAL(10,2),
  previous_price DECIMAL(10,2),
  stock_status TEXT, -- 'in_stock', 'out_of_stock', 'low_stock'
  price_change_percent DECIMAL(5,2),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les tendances marché détectées
CREATE TABLE public.market_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trend_type TEXT NOT NULL, -- 'price_drop', 'new_release', 'stock_alert', 'seasonal'
  product_category TEXT,
  trend_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les spécifications techniques extraites
CREATE TABLE public.technical_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  specs_data JSONB NOT NULL,
  compatibility_data JSONB,
  obsolescence_score DECIMAL(3,2),
  lifecycle_stage TEXT, -- 'new', 'mature', 'declining', 'obsolete'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour la matrice de compatibilité
CREATE TABLE public.compatibility_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  compatible_products JSONB, -- Array of compatible product IDs/names
  incompatible_products JSONB,
  required_accessories JSONB,
  regional_restrictions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les évaluations de risques
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  compliance_status JSONB, -- CE, RoHS, DEEE status
  warranty_analysis JSONB,
  return_prediction JSONB,
  authenticity_score DECIMAL(3,2),
  risk_level TEXT, -- 'low', 'medium', 'high'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les alertes utilisateur
CREATE TABLE public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  alert_data JSONB NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competitor_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibility_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competitor_sites
CREATE POLICY "Users can manage their own competitor sites"
  ON public.competitor_sites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for price_monitoring
CREATE POLICY "Users can view their own price monitoring"
  ON public.price_monitoring FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price monitoring"
  ON public.price_monitoring FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for market_trends
CREATE POLICY "Users can manage their own market trends"
  ON public.market_trends FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for technical_specs
CREATE POLICY "Users can manage their own technical specs"
  ON public.technical_specs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for compatibility_matrix
CREATE POLICY "Users can manage their own compatibility data"
  ON public.compatibility_matrix FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for risk_assessments
CREATE POLICY "Users can manage their own risk assessments"
  ON public.risk_assessments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_alerts
CREATE POLICY "Users can manage their own alerts"
  ON public.user_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_price_monitoring_user_product ON public.price_monitoring(user_id, product_name);
CREATE INDEX idx_price_monitoring_scraped_at ON public.price_monitoring(scraped_at DESC);
CREATE INDEX idx_market_trends_user_type ON public.market_trends(user_id, trend_type);
CREATE INDEX idx_user_alerts_user_unread ON public.user_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_competitor_sites_user_active ON public.competitor_sites(user_id, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_competitor_sites_updated_at
  BEFORE UPDATE ON public.competitor_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_technical_specs_updated_at
  BEFORE UPDATE ON public.technical_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_compatibility_matrix_updated_at
  BEFORE UPDATE ON public.compatibility_matrix
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_risk_assessments_updated_at
  BEFORE UPDATE ON public.risk_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();