-- Ajouter la colonne generation_metadata à la table rsgp_compliance
ALTER TABLE rsgp_compliance 
ADD COLUMN generation_metadata JSONB DEFAULT NULL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN rsgp_compliance.generation_metadata IS 
'Métadonnées de génération: method, timestamp, providers_tried, web_search_method, web_results_count';