-- Table pour stocker les données d'intelligence de marché enrichies
CREATE TABLE IF NOT EXISTS public.market_intelligence_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_ean TEXT,
  
  -- Prix collectés depuis différentes sources MCP
  amazon_price NUMERIC,
  google_shopping_min_price NUMERIC,
  google_shopping_max_price NUMERIC,
  google_shopping_avg_price NUMERIC,
  current_user_price NUMERIC,
  
  -- Métadonnées de la recherche
  competitors_count INTEGER DEFAULT 0,
  market_position TEXT, -- 'cheapest', 'average', 'expensive', 'premium'
  
  -- Recommandations IA
  ai_recommendation TEXT, -- 'lower_price', 'increase_price', 'maintain', 'review'
  ai_confidence_score NUMERIC DEFAULT 0,
  ai_reasoning TEXT,
  
  -- Tendances web (depuis Brave/Google MCP)
  search_volume_trend TEXT, -- 'increasing', 'stable', 'decreasing'
  market_demand TEXT, -- 'high', 'medium', 'low'
  
  -- Alertes automatiques
  alert_type TEXT, -- 'price_drop', 'competitor_cheaper', 'opportunity', 'threat'
  alert_severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  
  -- Timestamps
  check_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_market_intelligence_user ON public.market_intelligence_data(user_id);
CREATE INDEX idx_market_intelligence_timestamp ON public.market_intelligence_data(check_timestamp DESC);
CREATE INDEX idx_market_intelligence_ean ON public.market_intelligence_data(product_ean);
CREATE INDEX idx_market_intelligence_alerts ON public.market_intelligence_data(alert_type, alert_severity);

-- RLS Policies
ALTER TABLE public.market_intelligence_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own market intelligence"
ON public.market_intelligence_data
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own market intelligence"
ON public.market_intelligence_data
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own market intelligence"
ON public.market_intelligence_data
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own market intelligence"
ON public.market_intelligence_data
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_market_intelligence_updated_at
BEFORE UPDATE ON public.market_intelligence_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();