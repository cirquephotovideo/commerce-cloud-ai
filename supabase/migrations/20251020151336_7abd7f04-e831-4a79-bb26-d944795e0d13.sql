
-- Nettoyer le job avec mapping invalide (juste category:null)
DELETE FROM import_jobs 
WHERE id = '8bf192cd-a010-4ec7-a0ea-a31bcf40db1c';

-- Marquer l'email correspondant comme failed pour permettre un nouveau mapping
UPDATE email_inbox
SET status = 'failed',
    error_message = 'Mapping incomplet - Merci de refaire le mapping avec tous les champs requis',
    updated_at = NOW()
WHERE id = 'd40cd00b-0265-4cd3-9957-82f0f85f61c2';

-- Fonction pour relancer automatiquement les jobs bloqués depuis plus de 5 minutes
CREATE OR REPLACE FUNCTION trigger_stuck_import_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
    -- Appeler la fonction email-import-chunk via pg_net si disponible
    -- Sinon, marquer comme 'pending' pour retraitement manuel
    RAISE NOTICE 'Job stuck detected: % - marking for retry', stuck_job.id;
    
    UPDATE import_jobs
    SET status = 'pending',
        error_message = 'Job bloqué - relancé automatiquement',
        updated_at = NOW()
    WHERE id = stuck_job.id;
  END LOOP;
END;
$$;

-- Relancer maintenant tous les jobs bloqués valides
SELECT trigger_stuck_import_jobs();
