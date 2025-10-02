-- Ajouter le statut d'enrichissement Amazon aux analyses de produits
ALTER TABLE product_analyses
ADD COLUMN amazon_enrichment_status TEXT CHECK (amazon_enrichment_status IN ('pending', 'success', 'not_found', 'error'));

-- Ajouter une colonne pour la dernière tentative d'enrichissement
ALTER TABLE product_analyses
ADD COLUMN amazon_last_attempt TIMESTAMP WITH TIME ZONE;

-- Créer un index pour optimiser les requêtes par statut
CREATE INDEX idx_product_analyses_amazon_status ON product_analyses(amazon_enrichment_status);

-- Ajouter un commentaire pour documenter les valeurs possibles
COMMENT ON COLUMN product_analyses.amazon_enrichment_status IS 'Status: null=pas tenté, pending=en cours, success=OK, not_found=introuvable, error=erreur API';