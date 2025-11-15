-- ÉTAPE 1: Enrichissement Prix Marché - Colonnes supplier_price_variants
ALTER TABLE supplier_price_variants
ADD COLUMN IF NOT EXISTS market_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS market_price_source TEXT,
ADD COLUMN IF NOT EXISTS market_price_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suggested_selling_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS suggested_margin_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS price_competitiveness TEXT CHECK (price_competitiveness IN ('excellent', 'good', 'average', 'poor')),
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_supplier_price_variants_enrichment_status ON supplier_price_variants(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_supplier_price_variants_analysis_id ON supplier_price_variants(analysis_id);

-- ÉTAPE 1: Validation Pré-Export - Colonne product_analyses
ALTER TABLE product_analyses
ADD COLUMN IF NOT EXISTS pre_export_validation JSONB DEFAULT '{
  "completeness_score": 0,
  "description_ready": false,
  "images_ready": false,
  "specifications_ready": false,
  "pricing_ready": false,
  "stock_ready": false,
  "hs_code_ready": false,
  "odoo_category_ready": false,
  "amazon_data_ready": false,
  "last_validated_at": null,
  "missing_fields": []
}'::jsonb;

-- Index pour recherche rapide des produits incomplets
CREATE INDEX IF NOT EXISTS idx_product_analyses_pre_export_score ON product_analyses((pre_export_validation->>'completeness_score'));

-- Fonction trigger pour auto-détection du meilleur prix
CREATE OR REPLACE FUNCTION update_best_supplier_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour automatiquement le best_price dans product_analyses
  UPDATE product_analyses pa
  SET 
    analysis_result = jsonb_set(
      COALESCE(pa.analysis_result, '{}'::jsonb),
      '{best_supplier_price}',
      to_jsonb(
        (SELECT MIN(purchase_price) 
         FROM supplier_price_variants spv 
         WHERE spv.analysis_id = pa.id 
           AND spv.stock_quantity > 0)
      )
    ),
    analysis_result = jsonb_set(
      COALESCE(pa.analysis_result, '{}'::jsonb),
      '{best_supplier_id}',
      to_jsonb(
        (SELECT supplier_id::text
         FROM supplier_price_variants spv 
         WHERE spv.analysis_id = pa.id 
           AND spv.stock_quantity > 0
         ORDER BY purchase_price ASC
         LIMIT 1)
      )
    )
  WHERE pa.id = NEW.analysis_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_update_best_price ON supplier_price_variants;
CREATE TRIGGER trigger_update_best_price
AFTER INSERT OR UPDATE OF purchase_price, stock_quantity ON supplier_price_variants
FOR EACH ROW
EXECUTE FUNCTION update_best_supplier_price();