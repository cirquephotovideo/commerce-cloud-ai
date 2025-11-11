-- Fonction SQL batch pour créer les liens en masse
CREATE OR REPLACE FUNCTION bulk_create_product_links(p_user_id UUID)
RETURNS TABLE(
  links_created INTEGER,
  execution_time_ms INTEGER
) AS $$
DECLARE
  start_time TIMESTAMP;
  inserted_count INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  -- Insertion batch avec gestion des conflits
  WITH inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT 
      pa.id,
      sp.id,
      'auto',
      100,
      p_user_id
    FROM product_analyses pa
    INNER JOIN supplier_products sp 
      ON LOWER(TRIM(pa.ean)) = LOWER(TRIM(sp.ean))
    WHERE pa.user_id = p_user_id
      AND sp.user_id = p_user_id
      AND pa.ean IS NOT NULL 
      AND pa.ean != ''
      AND sp.ean IS NOT NULL
      AND sp.ean != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_links pl
        WHERE pl.analysis_id = pa.id 
          AND pl.supplier_product_id = sp.id
      )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT COUNT(*)::INTEGER INTO inserted_count FROM inserted;
  
  RETURN QUERY SELECT 
    inserted_count,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activer Realtime sur product_links
ALTER TABLE product_links REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE product_links;