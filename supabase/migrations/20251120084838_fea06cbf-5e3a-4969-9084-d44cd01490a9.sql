-- Fonction trigger pour ajouter automatiquement les produits à la file d'enrichissement
CREATE OR REPLACE FUNCTION trigger_auto_enrich_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insérer dans la file d'enrichissement avec tous les types
  INSERT INTO enrichment_queue (
    analysis_id,
    user_id,
    enrichment_type,
    priority,
    status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    ARRAY['description', 'specifications', 'cost_analysis', 'images', 'rsgp']::text[],
    'medium',
    'pending',
    NOW()
  )
  ON CONFLICT (analysis_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur product_analyses
DROP TRIGGER IF EXISTS auto_enrich_new_product ON product_analyses;
CREATE TRIGGER auto_enrich_new_product
  AFTER INSERT ON product_analyses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_enrich_new_product();

-- Ajouter un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_analysis_id 
ON enrichment_queue(analysis_id) 
WHERE status IN ('pending', 'processing');