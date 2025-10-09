-- Supprimer les doublons en gardant uniquement la configuration la plus récente par user_id
DELETE FROM ollama_configurations a
USING ollama_configurations b
WHERE a.user_id = b.user_id 
  AND a.created_at < b.created_at;

-- Ajouter une contrainte unique sur user_id pour éviter les futurs doublons
ALTER TABLE ollama_configurations
ADD CONSTRAINT ollama_configurations_user_id_unique UNIQUE (user_id);