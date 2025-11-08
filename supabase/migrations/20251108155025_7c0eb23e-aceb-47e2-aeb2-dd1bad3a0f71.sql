-- Phase 6: Mettre à jour le modèle par défaut pour les configurations existantes
UPDATE ollama_configurations 
SET default_model = 'gpt-oss:20b-cloud'
WHERE default_model = 'gpt-oss:120b-cloud'
  AND ollama_url = 'https://ollama.com';

-- Ajouter un commentaire explicatif sur la colonne
COMMENT ON COLUMN ollama_configurations.default_model IS 
  'Modèle par défaut. Recommandé: gpt-oss:20b-cloud (rapide) ou gpt-oss:120b-cloud (puissant mais lent)';

-- Log de la mise à jour
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % configurations to use gpt-oss:20b-cloud as default model', updated_count;
END $$;