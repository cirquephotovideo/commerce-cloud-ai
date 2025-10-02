-- Phase 1: Configuration Base de Données Amazon Seller API

-- 1. Table des credentials Amazon (secrets)
CREATE TABLE amazon_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  marketplace_id TEXT NOT NULL DEFAULT 'A13V1IB3VIYZZH',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des access tokens (auto-générés)
CREATE TABLE amazon_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  credential_id UUID REFERENCES amazon_credentials(id)
);

CREATE INDEX idx_token_expiry ON amazon_access_tokens(expires_at);
CREATE INDEX idx_token_credential ON amazon_access_tokens(credential_id);

-- 3. Table des données produits Amazon
CREATE TABLE amazon_product_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID UNIQUE REFERENCES product_analyses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Identifiants
  asin TEXT NOT NULL,
  ean TEXT,
  
  -- Info produit
  title TEXT,
  brand TEXT,
  manufacturer TEXT,
  product_type TEXT,
  
  -- Prix
  buy_box_price NUMERIC,
  list_price NUMERIC,
  lowest_new_price NUMERIC,
  offer_count_new INTEGER,
  
  -- Images
  images JSONB DEFAULT '[]'::jsonb,
  
  -- Dimensions
  item_dimensions JSONB,
  package_dimensions JSONB,
  item_weight NUMERIC,
  package_weight NUMERIC,
  
  -- Ventes
  sales_rank JSONB,
  
  -- Détails
  features TEXT[],
  color TEXT,
  size TEXT,
  
  -- Métadonnées
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_amazon_asin ON amazon_product_data(asin);
CREATE INDEX idx_amazon_user ON amazon_product_data(user_id);
CREATE INDEX idx_amazon_analysis ON amazon_product_data(analysis_id);

-- Trigger pour updated_at
CREATE TRIGGER update_amazon_product_data_updated_at
  BEFORE UPDATE ON amazon_product_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE amazon_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_product_data ENABLE ROW LEVEL SECURITY;

-- Seuls les super admins peuvent gérer les credentials
CREATE POLICY "Super admins can manage credentials"
  ON amazon_credentials FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Les tokens sont gérés par le système (service role)
CREATE POLICY "System can manage tokens"
  ON amazon_access_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Les utilisateurs voient leurs propres données produit
CREATE POLICY "Users can view their Amazon data"
  ON amazon_product_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their Amazon data"
  ON amazon_product_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their Amazon data"
  ON amazon_product_data FOR UPDATE
  USING (auth.uid() = user_id);