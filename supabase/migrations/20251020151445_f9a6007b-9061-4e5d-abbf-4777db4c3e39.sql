
-- Corriger la fonction pour ajouter le search_path pour la sécurité
CREATE OR REPLACE FUNCTION trigger_stuck_import_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stuck_job RECORD;
BEGIN
  -- Trouver les jobs en queued depuis plus de 5 min avec un mapping valide
  FOR stuck_job IN 
    SELECT 
      id,
      metadata->>'inbox_id' as inbox_id,
      metadata->'mapping' as mapping,
      metadata->'skip_config' as skip_config,
      metadata->'excluded_columns' as excluded_columns,
      metadata->>'ndjson_path' as ndjson_path,
      progress_total
    FROM import_jobs
    WHERE status = 'queued'
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND progress_current = 0
      AND progress_total > 0
      AND metadata->'mapping'->>'product_name' IS NOT NULL
      AND metadata->'mapping'->>'purchase_price' IS NOT NULL
    LIMIT 10
  LOOP
    RAISE NOTICE 'Job stuck detected: % - marking for retry', stuck_job.id;
    
    UPDATE import_jobs
    SET status = 'pending',
        error_message = 'Job bloqué - relancé automatiquement',
        updated_at = NOW()
    WHERE id = stuck_job.id;
  END LOOP;
END;
$$;
