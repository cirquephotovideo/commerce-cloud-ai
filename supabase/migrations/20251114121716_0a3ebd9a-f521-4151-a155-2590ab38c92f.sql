-- Ajouter les index critiques pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_id 
  ON product_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_user_ean 
  ON supplier_products(user_id, ean) 
  WHERE ean IS NOT NULL AND ean != '';

CREATE INDEX IF NOT EXISTS idx_product_links_analysis_supplier 
  ON product_links(analysis_id, supplier_product_id);