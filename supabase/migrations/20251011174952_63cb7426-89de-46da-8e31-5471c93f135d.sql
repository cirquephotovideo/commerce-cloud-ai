-- Ajouter les paramètres IA pour le matching automatique
ALTER TABLE supplier_configurations
ADD COLUMN auto_matching_enabled BOOLEAN DEFAULT true,
ADD COLUMN matching_threshold INTEGER DEFAULT 70;

COMMENT ON COLUMN supplier_configurations.auto_matching_enabled IS 'Active le matching automatique des produits fournisseurs avec les analyses existantes';
COMMENT ON COLUMN supplier_configurations.matching_threshold IS 'Seuil minimum de confiance (%) pour créer un lien automatique (60-90)';