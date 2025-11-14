-- Nettoyer les jobs Amazon bloqués
UPDATE amazon_auto_link_jobs
SET 
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Job interrompu - fonction non déployée. Relancez la fusion Amazon.'
WHERE status IN ('pending', 'processing')
  AND completed_at IS NULL;

-- Fonction de nettoyage automatique pour éviter les jobs fantômes
CREATE OR REPLACE FUNCTION cleanup_stuck_amazon_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Marquer comme failed les jobs en processing depuis plus de 10 minutes
  UPDATE amazon_auto_link_jobs
  SET 
    status = 'failed',
    completed_at = NOW(),
    error_message = 'Timeout: job bloqué depuis plus de 10 minutes'
  WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes'
    AND completed_at IS NULL;
END;
$$;