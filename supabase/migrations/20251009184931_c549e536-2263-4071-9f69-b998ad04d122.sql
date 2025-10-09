-- Phase 1: Ajouter colonnes enrichment dans supplier_products
ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'completed', 'failed'));

ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS enrichment_progress INTEGER DEFAULT 0 CHECK (enrichment_progress >= 0 AND enrichment_progress <= 100);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_supplier_products_enrichment_status ON supplier_products(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_supplier_products_user_status ON supplier_products(user_id, enrichment_status);

-- Ajouter supplier_product_id dans product_analyses pour lien bidirectionnel
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS supplier_product_id UUID REFERENCES supplier_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_analyses_supplier_product ON product_analyses(supplier_product_id);