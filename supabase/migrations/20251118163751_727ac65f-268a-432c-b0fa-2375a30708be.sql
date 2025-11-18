-- Phase 1: Fonction améliorée pour créer TOUS les liens par EAN (multi-fournisseurs)
CREATE OR REPLACE FUNCTION bulk_create_all_supplier_links_by_ean(p_user_id UUID)
RETURNS TABLE(
  links_created INTEGER,
  products_matched INTEGER,
  execution_time_ms INTEGER
) AS $$
DECLARE
  start_time TIMESTAMP;
  inserted_count INTEGER;
  matched_products INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  -- Créer TOUS les liens possibles par EAN (1 analysis → N suppliers)
  WITH inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT DISTINCT
      pa.id AS analysis_id,
      sp.id AS supplier_product_id,
      'automatic' AS link_type,
      100 AS confidence_score,
      p_user_id
    FROM product_analyses pa
    INNER JOIN supplier_products sp 
      ON pa.ean = sp.ean
    WHERE pa.user_id = p_user_id
      AND sp.user_id = p_user_id
      AND pa.ean IS NOT NULL
      AND sp.ean IS NOT NULL
      AND pa.ean != ''
      AND sp.ean != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_links pl
        WHERE pl.analysis_id = pa.id 
          AND pl.supplier_product_id = sp.id
      )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING analysis_id, supplier_product_id
  ),
  unique_analyses AS (
    SELECT COUNT(DISTINCT analysis_id) AS count FROM inserted
  )
  SELECT 
    COUNT(*)::INTEGER,
    (SELECT count FROM unique_analyses)::INTEGER
  INTO inserted_count, matched_products
  FROM inserted;
  
  RETURN QUERY SELECT 
    inserted_count,
    matched_products,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 6: Table pour les alertes de changement de prix
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_product_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  old_price DECIMAL(10,2) NOT NULL,
  new_price DECIMAL(10,2) NOT NULL,
  change_percent DECIMAL(5,2) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'price_increase')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created_at ON price_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_alerts_is_read ON price_alerts(is_read) WHERE is_read = FALSE;

-- RLS pour price_alerts
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own price alerts"
  ON price_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own price alerts"
  ON price_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert price alerts"
  ON price_alerts FOR INSERT
  WITH CHECK (true);

-- Trigger pour détecter les changements de prix significatifs
CREATE OR REPLACE FUNCTION notify_significant_price_change()
RETURNS TRIGGER AS $$
DECLARE
  price_change_percent NUMERIC;
  analysis_name TEXT;
BEGIN
  -- Calculer le changement de prix
  IF OLD.purchase_price > 0 AND NEW.purchase_price IS DISTINCT FROM OLD.purchase_price THEN
    price_change_percent := ABS((NEW.purchase_price - OLD.purchase_price) / OLD.purchase_price * 100);
  ELSE
    RETURN NEW;
  END IF;
  
  -- Si changement > 10%, créer une notification
  IF price_change_percent > 10 THEN
    -- Récupérer le nom du produit analysé
    SELECT pa.analysis_result->>'name' INTO analysis_name
    FROM product_links pl
    INNER JOIN product_analyses pa ON pl.analysis_id = pa.id
    WHERE pl.supplier_product_id = NEW.id
    LIMIT 1;
    
    -- Insérer notification
    INSERT INTO price_alerts (
      user_id,
      supplier_product_id,
      product_name,
      old_price,
      new_price,
      change_percent,
      alert_type
    ) VALUES (
      NEW.user_id,
      NEW.id,
      COALESCE(analysis_name, NEW.product_name),
      OLD.purchase_price,
      NEW.purchase_price,
      price_change_percent,
      CASE 
        WHEN NEW.purchase_price < OLD.purchase_price THEN 'price_drop'
        ELSE 'price_increase'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_price_change_notification
AFTER UPDATE OF purchase_price ON supplier_products
FOR EACH ROW
WHEN (OLD.purchase_price IS DISTINCT FROM NEW.purchase_price)
EXECUTE FUNCTION notify_significant_price_change();

-- Phase 7: Fonction RPC pour obtenir les meilleures opportunités d'économies
CREATE OR REPLACE FUNCTION get_best_savings_opportunities(p_user_id UUID DEFAULT NULL, p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  ean TEXT,
  supplier_count INTEGER,
  best_price DECIMAL(10,2),
  worst_price DECIMAL(10,2),
  max_savings DECIMAL(10,2),
  avg_price DECIMAL(10,2),
  total_stock INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH supplier_prices AS (
    SELECT 
      pa.id AS product_id,
      pa.analysis_result->>'name' AS product_name,
      pa.ean,
      sp.id AS supplier_product_id,
      sp.purchase_price,
      sp.stock_quantity,
      sc.supplier_name
    FROM product_analyses pa
    INNER JOIN product_links pl ON pa.id = pl.analysis_id
    INNER JOIN supplier_products sp ON pl.supplier_product_id = sp.id
    LEFT JOIN supplier_configurations sc ON sp.supplier_id = sc.id
    WHERE pa.user_id = COALESCE(p_user_id, auth.uid())
      AND sp.purchase_price > 0
  ),
  aggregated AS (
    SELECT 
      product_id,
      product_name,
      ean,
      COUNT(DISTINCT supplier_product_id)::INTEGER AS supplier_count,
      MIN(purchase_price) AS best_price,
      MAX(purchase_price) AS worst_price,
      (MAX(purchase_price) - MIN(purchase_price)) AS max_savings,
      AVG(purchase_price) AS avg_price,
      SUM(COALESCE(stock_quantity, 0))::INTEGER AS total_stock
    FROM supplier_prices
    GROUP BY product_id, product_name, ean
    HAVING COUNT(DISTINCT supplier_product_id) >= 2
  )
  SELECT 
    a.product_id,
    a.product_name,
    a.ean,
    a.supplier_count,
    a.best_price,
    a.worst_price,
    a.max_savings,
    a.avg_price,
    a.total_stock
  FROM aggregated a
  WHERE a.max_savings > 0
  ORDER BY a.max_savings DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;