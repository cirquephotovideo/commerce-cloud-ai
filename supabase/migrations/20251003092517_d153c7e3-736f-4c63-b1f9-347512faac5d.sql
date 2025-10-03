-- Migration pour ajouter product_name aux analyses existantes
-- Cette migration met à jour les analysis_result pour inclure product_name au niveau racine

DO $$
DECLARE
  analysis_record RECORD;
  product_name_value TEXT;
  updated_result JSONB;
BEGIN
  -- Parcourir toutes les analyses qui n'ont pas product_name au niveau racine
  FOR analysis_record IN 
    SELECT id, analysis_result, product_url
    FROM product_analyses
    WHERE NOT (analysis_result ? 'product_name')
  LOOP
    -- Essayer d'extraire le nom depuis différentes sources
    product_name_value := COALESCE(
      analysis_record.analysis_result->'description'->>'suggested_description',
      analysis_record.analysis_result->>'name',
      analysis_record.analysis_result->>'title',
      -- Extraire un nom basique depuis l'URL (dernier segment)
      regexp_replace(
        substring(analysis_record.product_url from '[^/]+$'),
        '[_-]', ' ', 'g'
      )
    );
    
    -- Si toujours pas de nom, utiliser "Produit"
    IF product_name_value IS NULL OR product_name_value = '' THEN
      product_name_value := 'Produit ' || substring(analysis_record.id::text from 1 for 8);
    END IF;
    
    -- Ajouter product_name au début du JSON
    updated_result := jsonb_build_object('product_name', product_name_value) || analysis_record.analysis_result;
    
    -- Mettre à jour l'enregistrement
    UPDATE product_analyses
    SET analysis_result = updated_result,
        updated_at = now()
    WHERE id = analysis_record.id;
    
    RAISE NOTICE 'Updated analysis % with product_name: %', analysis_record.id, product_name_value;
  END LOOP;
END $$;