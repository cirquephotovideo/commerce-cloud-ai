-- ============================================
-- PHASE 1: Index Optimisés pour Fix Timeout SQL
-- ============================================

-- Index pour recherche par EAN (normalisé)
CREATE INDEX IF NOT EXISTS idx_supplier_products_normalized_ean 
ON supplier_products(normalized_ean) 
WHERE normalized_ean IS NOT NULL;

-- Index pour recherche par SKU/Reference
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_reference 
ON supplier_products(supplier_reference) 
WHERE supplier_reference IS NOT NULL;

-- Index pour filtrage par fournisseur
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id 
ON supplier_products(supplier_id);

-- Index pour filtrage par nom de produit (recherche textuelle)
CREATE INDEX IF NOT EXISTS idx_supplier_products_product_name_gin 
ON supplier_products USING gin(to_tsvector('french', product_name));

-- Index pour filtrage par prix
CREATE INDEX IF NOT EXISTS idx_supplier_products_purchase_price 
ON supplier_products(purchase_price) 
WHERE purchase_price IS NOT NULL;

-- Index pour filtrage par statut d'enrichissement
CREATE INDEX IF NOT EXISTS idx_supplier_products_enrichment_status 
ON supplier_products(enrichment_status);

-- Index composite pour requêtes fréquentes (supplier + EAN)
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_ean 
ON supplier_products(supplier_id, normalized_ean) 
WHERE normalized_ean IS NOT NULL;

-- Index pour product_analyses par EAN normalisé
CREATE INDEX IF NOT EXISTS idx_product_analyses_normalized_ean 
ON product_analyses(normalized_ean) 
WHERE normalized_ean IS NOT NULL;

-- Index pour product_analyses par user_id et created_at (pagination efficace)
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_created 
ON product_analyses(user_id, created_at DESC);

-- Index pour product_links (jointures fréquentes)
CREATE INDEX IF NOT EXISTS idx_product_links_analysis_supplier 
ON product_links(analysis_id, supplier_product_id);

-- Index GIN pour enrichment_status (requêtes JSON)
CREATE INDEX IF NOT EXISTS idx_product_analyses_enrichment_status_gin 
ON product_analyses USING gin(enrichment_status);

-- Augmenter le timeout par défaut pour requêtes complexes légitimes
ALTER DATABASE postgres SET statement_timeout = '30s';

-- Commenter les stats pour le planificateur de requêtes
COMMENT ON INDEX idx_supplier_products_normalized_ean IS 'Accélère la recherche par EAN normalisé';
COMMENT ON INDEX idx_supplier_products_product_name_gin IS 'Recherche full-text sur le nom du produit';
COMMENT ON INDEX idx_product_analyses_user_created IS 'Pagination efficace par utilisateur et date';