-- Phase 1: Ajouter les colonnes d'enrichissement manquantes à product_analyses
ALTER TABLE product_analyses 
  ADD COLUMN IF NOT EXISTS specifications JSONB,
  ADD COLUMN IF NOT EXISTS long_description TEXT,
  ADD COLUMN IF NOT EXISTS cost_analysis JSONB,
  ADD COLUMN IF NOT EXISTS rsgp_compliance JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_status JSONB DEFAULT '{
    "base_analysis": "pending",
    "specifications": "pending",
    "technical_description": "pending",
    "cost_analysis": "pending",
    "rsgp": "pending"
  }'::jsonb;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_product_analyses_enrichment_status 
  ON product_analyses USING GIN (enrichment_status);

CREATE INDEX IF NOT EXISTS idx_product_analyses_specifications 
  ON product_analyses USING GIN (specifications);

-- Mettre à jour les analyses existantes avec un statut par défaut
UPDATE product_analyses 
SET enrichment_status = '{
  "base_analysis": "completed",
  "specifications": "pending",
  "technical_description": "pending",
  "cost_analysis": "pending",
  "rsgp": "pending"
}'::jsonb
WHERE enrichment_status IS NULL;

-- Ajouter des commentaires pour la documentation
COMMENT ON COLUMN product_analyses.specifications IS 'Spécifications techniques détaillées générées par IA';
COMMENT ON COLUMN product_analyses.long_description IS 'Description technique longue (>500 mots) générée par IA';
COMMENT ON COLUMN product_analyses.cost_analysis IS 'Analyse des coûts et marges générée par IA';
COMMENT ON COLUMN product_analyses.rsgp_compliance IS 'Données de conformité RSGP générées par IA';
COMMENT ON COLUMN product_analyses.enrichment_status IS 'État de chaque type d''enrichissement (pending/processing/completed/failed)';