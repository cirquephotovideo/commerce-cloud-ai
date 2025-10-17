-- Nettoyer les tâches d'enrichissement orphelines (sans supplier_product_id)
UPDATE enrichment_queue
SET 
  status = 'failed',
  error_message = 'Tâche orpheline : supplier_product_id manquant (nettoyage automatique)',
  completed_at = NOW(),
  updated_at = NOW()
WHERE status IN ('pending', 'processing')
  AND supplier_product_id IS NULL;

-- Ajouter une contrainte pour empêcher la création de futures tâches sans supplier_product_id
ALTER TABLE enrichment_queue
  ADD CONSTRAINT check_supplier_product_id_not_null 
  CHECK (
    (supplier_product_id IS NOT NULL) OR 
    (analysis_id IS NOT NULL)
  );