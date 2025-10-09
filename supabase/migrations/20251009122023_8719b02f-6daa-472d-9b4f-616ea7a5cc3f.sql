-- Nettoyage des vidéos doublons en processing
-- Supprimer toutes les vidéos en processing sauf la plus récente par analysis_id
DELETE FROM product_videos
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY analysis_id ORDER BY created_at DESC) as rn
    FROM product_videos
    WHERE status = 'processing'
  ) t
  WHERE t.rn > 1
);

-- Marquer comme failed toutes les vidéos en processing depuis plus de 10 minutes
UPDATE product_videos
SET status = 'failed', 
    error_message = 'Timeout: Plus de 10 minutes écoulées'
WHERE status = 'processing' 
  AND created_at < now() - interval '10 minutes';

-- Ajouter une contrainte unique pour empêcher les doublons futurs
-- (permet plusieurs failed, mais un seul processing/pending/completed par analysis_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_videos_analysis_active 
ON product_videos(analysis_id) 
WHERE status IN ('processing', 'pending', 'completed');