-- Ajouter colonnes normalized_ean pour optimiser les recherches
ALTER TABLE product_analyses ADD COLUMN IF NOT EXISTS normalized_ean TEXT;
ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS normalized_ean TEXT;

-- Populer les valeurs existantes
UPDATE product_analyses 
SET normalized_ean = LOWER(TRIM(ean)) 
WHERE ean IS NOT NULL AND ean != '' AND normalized_ean IS NULL;

UPDATE supplier_products 
SET normalized_ean = LOWER(TRIM(ean)) 
WHERE ean IS NOT NULL AND ean != '' AND normalized_ean IS NULL;

-- Index sur colonnes normalisées
CREATE INDEX IF NOT EXISTS idx_product_analyses_normalized_ean 
  ON product_analyses(user_id, normalized_ean) 
  WHERE normalized_ean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_normalized_ean 
  ON supplier_products(user_id, normalized_ean) 
  WHERE normalized_ean IS NOT NULL;