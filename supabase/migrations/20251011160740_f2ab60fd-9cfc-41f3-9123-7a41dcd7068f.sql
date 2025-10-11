-- Table pour stocker les emails reçus et leur traitement
CREATE TABLE email_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES supplier_configurations(id) ON DELETE SET NULL,
  
  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  
  -- Fichier joint
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_url TEXT,
  attachment_size_kb INT,
  
  -- Détection IA
  detected_supplier_name TEXT,
  detection_confidence NUMERIC(5,2),
  detection_method TEXT CHECK (detection_method IN ('email', 'filename', 'content', 'manual')),
  
  -- Traitement
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  products_found INT DEFAULT 0,
  products_updated INT DEFAULT 0,
  products_created INT DEFAULT 0,
  error_message TEXT,
  processing_logs JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour gérer plusieurs prix fournisseurs par produit enrichi
CREATE TABLE supplier_price_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Liens
  analysis_id UUID REFERENCES product_analyses(id) ON DELETE CASCADE,
  supplier_product_id UUID REFERENCES supplier_products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES supplier_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Prix fournisseur
  supplier_reference TEXT,
  purchase_price NUMERIC(10,2),
  selling_price NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  stock_quantity INT,
  
  -- Historique
  last_updated TIMESTAMPTZ DEFAULT now(),
  price_history JSONB DEFAULT '[]'::jsonb,
  
  -- Match info
  match_type TEXT CHECK (match_type IN ('ean', 'name', 'reference', 'manual')),
  match_confidence NUMERIC(5,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Un seul prix par fournisseur par produit
  UNIQUE(analysis_id, supplier_id)
);

-- Indexes pour performance
CREATE INDEX idx_email_inbox_user ON email_inbox(user_id);
CREATE INDEX idx_email_inbox_status ON email_inbox(status);
CREATE INDEX idx_email_inbox_supplier ON email_inbox(supplier_id);
CREATE INDEX idx_email_inbox_received ON email_inbox(received_at DESC);

CREATE INDEX idx_supplier_price_variants_analysis ON supplier_price_variants(analysis_id);
CREATE INDEX idx_supplier_price_variants_supplier ON supplier_price_variants(supplier_id);
CREATE INDEX idx_supplier_price_variants_user ON supplier_price_variants(user_id);

-- RLS Policies pour email_inbox
ALTER TABLE email_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inbox"
  ON email_inbox FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inbox entries"
  ON email_inbox FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inbox entries"
  ON email_inbox FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert inbox entries"
  ON email_inbox FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update inbox entries"
  ON email_inbox FOR UPDATE
  USING (true);

-- RLS Policies pour supplier_price_variants
ALTER TABLE supplier_price_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own price variants"
  ON supplier_price_variants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price variants"
  ON supplier_price_variants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own price variants"
  ON supplier_price_variants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own price variants"
  ON supplier_price_variants FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage price variants"
  ON supplier_price_variants FOR ALL
  USING (true)
  WITH CHECK (true);

-- Triggers pour updated_at
CREATE TRIGGER update_email_inbox_updated_at
  BEFORE UPDATE ON email_inbox
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_price_variants_updated_at
  BEFORE UPDATE ON supplier_price_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();