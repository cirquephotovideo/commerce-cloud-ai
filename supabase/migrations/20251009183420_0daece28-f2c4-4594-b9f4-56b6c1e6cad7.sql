-- Phase 3: Système d'Import Fournisseurs - Migration Corrigée

-- 1. Ajouter colonne EAN dans product_analyses pour matching fiable
ALTER TABLE product_analyses ADD COLUMN IF NOT EXISTS ean TEXT;
CREATE INDEX IF NOT EXISTS idx_product_analyses_ean ON product_analyses(ean);

-- Extraire EAN depuis analysis_result pour données existantes
UPDATE product_analyses
SET ean = (analysis_result->>'ean')::text
WHERE analysis_result IS NOT NULL
  AND analysis_result->>'ean' IS NOT NULL
  AND (ean IS NULL OR ean = '');

-- 2. Ajouter support import dans platform_configurations
ALTER TABLE platform_configurations 
ADD COLUMN IF NOT EXISTS supports_import BOOLEAN DEFAULT false;

UPDATE platform_configurations 
SET supports_import = true 
WHERE platform_type IN (
  'odoo', 'shopify', 'prestashop', 'woocommerce', 
  'magento', 'salesforce', 'sap'
);

-- 3. Améliorer error_details dans supplier_import_logs
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_import_logs' 
    AND column_name = 'error_details'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE supplier_import_logs 
    ALTER COLUMN error_details TYPE jsonb USING 
      CASE 
        WHEN error_details IS NULL OR error_details = '' THEN NULL
        ELSE error_details::jsonb
      END;
  END IF;
END $$;

-- 4. Trigger calcul marge automatique (corrigé: extrait prix du jsonb)
CREATE OR REPLACE FUNCTION calculate_product_margin()
RETURNS TRIGGER AS $$
DECLARE
  selling_price NUMERIC;
BEGIN
  -- Extraire le prix de vente depuis analysis_result
  IF NEW.analysis_result IS NOT NULL THEN
    -- Essayer plusieurs clés possibles
    selling_price := COALESCE(
      (NEW.analysis_result->>'price')::numeric,
      (NEW.analysis_result->>'selling_price')::numeric,
      (NEW.analysis_result->>'recommended_price')::numeric
    );
  END IF;

  -- Calculer la marge si prix d'achat et prix de vente existent
  IF NEW.purchase_price IS NOT NULL 
     AND NEW.purchase_price > 0 
     AND selling_price IS NOT NULL 
     AND selling_price > 0 THEN
    NEW.margin_percentage := ROUND(
      ((selling_price - NEW.purchase_price) / NEW.purchase_price) * 100,
      2
    );
  ELSE
    NEW.margin_percentage := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_calculate_margin ON product_analyses;
CREATE TRIGGER trigger_calculate_margin
BEFORE INSERT OR UPDATE OF analysis_result, purchase_price ON product_analyses
FOR EACH ROW
EXECUTE FUNCTION calculate_product_margin();

-- 5. Fonction validation EAN-13
CREATE OR REPLACE FUNCTION is_valid_ean13(ean TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  digits INT[];
  checksum INT;
  calculated_checksum INT;
  sum INT := 0;
  i INT;
BEGIN
  -- Vérifier format (13 chiffres)
  IF ean IS NULL OR ean !~ '^\d{13}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Extraire les chiffres
  FOR i IN 1..13 LOOP
    digits[i] := substring(ean FROM i FOR 1)::INT;
  END LOOP;
  
  checksum := digits[13];
  
  -- Calculer le checksum (positions impaires *1, paires *3)
  FOR i IN 1..12 LOOP
    IF i % 2 = 1 THEN
      sum := sum + digits[i];
    ELSE
      sum := sum + (digits[i] * 3);
    END IF;
  END LOOP;
  
  calculated_checksum := (10 - (sum % 10)) % 10;
  
  RETURN checksum = calculated_checksum;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

-- 6. Ajouter colonne last_sync_at dans supplier_configurations si manquante
ALTER TABLE supplier_configurations 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- 7. Index de performance pour les jointures fréquentes
CREATE INDEX IF NOT EXISTS idx_supplier_products_ean ON supplier_products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_products_user_supplier ON supplier_products(user_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_ean ON product_analyses(user_id, ean) WHERE ean IS NOT NULL;

-- 8. Recalculer les marges existantes
UPDATE product_analyses
SET margin_percentage = calculate_product_margin.margin_percentage
FROM (
  SELECT id, margin_percentage 
  FROM product_analyses
) AS calculate_product_margin
WHERE product_analyses.id = calculate_product_margin.id
  AND product_analyses.purchase_price IS NOT NULL;