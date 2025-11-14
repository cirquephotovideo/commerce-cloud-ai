-- Fonction pour maintenir la normalisation automatique des EAN
CREATE OR REPLACE FUNCTION normalize_ean() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ean IS NOT NULL AND NEW.ean != '' THEN
    NEW.normalized_ean := LOWER(TRIM(NEW.ean));
  ELSE
    NEW.normalized_ean := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour auto-normalisation
DROP TRIGGER IF EXISTS product_analyses_normalize_ean ON product_analyses;
CREATE TRIGGER product_analyses_normalize_ean
  BEFORE INSERT OR UPDATE OF ean ON product_analyses
  FOR EACH ROW EXECUTE FUNCTION normalize_ean();

DROP TRIGGER IF EXISTS supplier_products_normalize_ean ON supplier_products;
CREATE TRIGGER supplier_products_normalize_ean
  BEFORE INSERT OR UPDATE OF ean ON supplier_products
  FOR EACH ROW EXECUTE FUNCTION normalize_ean();

-- Optimiser la fonction bulk_create_product_links_chunked avec timeout augmenté
CREATE OR REPLACE FUNCTION bulk_create_product_links_chunked(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  links_created INTEGER,
  processed_count INTEGER,
  has_more BOOLEAN
) AS $$
DECLARE
  inserted_count INTEGER;
  total_analyzed INTEGER;
BEGIN
  -- Augmenter le timeout pour cette fonction à 2 minutes
  SET LOCAL statement_timeout = '120s';
  
  -- Utiliser normalized_ean pour éviter LOWER(TRIM()) dans les JOIN
  WITH batch_analyses AS (
    SELECT id, normalized_ean
    FROM product_analyses
    WHERE user_id = p_user_id
      AND normalized_ean IS NOT NULL
    ORDER BY id
    LIMIT p_limit
    OFFSET p_offset
  ),
  inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT 
      ba.id,
      sp.id,
      'auto',
      1.0,
      p_user_id
    FROM batch_analyses ba
    INNER JOIN supplier_products sp 
      ON sp.normalized_ean = ba.normalized_ean
      AND sp.user_id = p_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_links pl
      WHERE pl.analysis_id = ba.id 
        AND pl.supplier_product_id = sp.id
    )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT 
    COUNT(*)::INTEGER INTO inserted_count
  FROM inserted;
  
  SELECT COUNT(*)::INTEGER INTO total_analyzed
  FROM batch_analyses;
  
  RETURN QUERY SELECT 
    inserted_count,
    total_analyzed,
    total_analyzed >= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;