-- Create product_videos table for HeyGen videos
CREATE TABLE IF NOT EXISTS product_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES product_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'pending',
  template_id TEXT,
  avatar_id TEXT,
  voice_id TEXT,
  script TEXT,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE product_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_videos
CREATE POLICY "Users can view their own videos"
  ON product_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos"
  ON product_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
  ON product_videos FOR UPDATE
  USING (auth.uid() = user_id);

-- Create rsgp_compliance table
CREATE TABLE IF NOT EXISTS rsgp_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES product_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Identification produit
  nom_produit TEXT NOT NULL,
  reference_interne TEXT,
  ean TEXT,
  numero_lot TEXT,
  numero_modele TEXT,
  categorie_rsgp TEXT,
  
  -- Fabricant
  fabricant_nom TEXT,
  fabricant_adresse TEXT,
  pays_origine TEXT,
  personne_responsable_ue TEXT,
  
  -- Conformité
  normes_ce TEXT[],
  documents_conformite JSONB,
  evaluation_risque TEXT,
  date_evaluation DATE,
  
  -- Logiciel
  firmware_ou_logiciel TEXT,
  
  -- Sécurité
  procedure_rappel TEXT,
  historique_incidents JSONB,
  notice_pdf TEXT,
  avertissements TEXT[],
  age_recommande TEXT,
  
  -- Technique
  compatibilites TEXT[],
  entretien TEXT,
  recyclage TEXT,
  indice_reparabilite NUMERIC(3,1),
  indice_energie TEXT,
  
  -- Service
  garantie TEXT,
  service_consommateur TEXT,
  langues_disponibles TEXT[],
  
  -- Validation
  rsgp_valide BOOLEAN DEFAULT FALSE,
  date_mise_conformite DATE,
  responsable_conformite TEXT,
  documents_archives JSONB,
  fournisseur TEXT,
  date_import_odoo DATE,
  
  -- Meta
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  validation_status TEXT DEFAULT 'draft'
);

-- Enable RLS
ALTER TABLE rsgp_compliance ENABLE ROW LEVEL SECURITY;

-- RLS policies for rsgp_compliance
CREATE POLICY "Users can view their own RSGP data"
  ON rsgp_compliance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own RSGP data"
  ON rsgp_compliance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSGP data"
  ON rsgp_compliance FOR UPDATE
  USING (auth.uid() = user_id);

-- Add columns to product_analyses
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS heygen_video_id UUID REFERENCES product_videos(id),
ADD COLUMN IF NOT EXISTS rsgp_compliance_id UUID REFERENCES rsgp_compliance(id),
ADD COLUMN IF NOT EXISTS enrichment_status JSONB DEFAULT '{"heygen": "not_started", "rsgp": "not_started"}'::JSONB;