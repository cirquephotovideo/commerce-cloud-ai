-- Trigger pour créer automatiquement supplier_price_variants lors de la création d'un product_link
CREATE OR REPLACE FUNCTION sync_supplier_price_variant()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer ou mettre à jour supplier_price_variants à partir des données de supplier_products
  INSERT INTO supplier_price_variants (
    analysis_id,
    supplier_id,
    supplier_product_id,
    purchase_price,
    stock_quantity,
    currency,
    user_id,
    last_synced_at
  )
  SELECT 
    NEW.analysis_id,
    sp.supplier_id,
    sp.id,
    sp.purchase_price,
    sp.stock_quantity,
    'EUR',
    NEW.user_id,
    NOW()
  FROM supplier_products sp
  WHERE sp.id = NEW.supplier_product_id
  ON CONFLICT (analysis_id, supplier_product_id) 
  DO UPDATE SET
    purchase_price = EXCLUDED.purchase_price,
    stock_quantity = EXCLUDED.stock_quantity,
    last_synced_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger
DROP TRIGGER IF EXISTS after_product_link_insert ON product_links;
CREATE TRIGGER after_product_link_insert
AFTER INSERT ON product_links
FOR EACH ROW
EXECUTE FUNCTION sync_supplier_price_variant();