-- Nettoyer les doublons existants en gardant le plus récent
DELETE FROM rsgp_compliance
WHERE id NOT IN (
  SELECT DISTINCT ON (analysis_id) id
  FROM rsgp_compliance
  ORDER BY analysis_id, generated_at DESC
);

-- Ajouter une contrainte UNIQUE pour empêcher les futurs doublons
ALTER TABLE rsgp_compliance 
ADD CONSTRAINT unique_analysis_rsgp 
UNIQUE (analysis_id);