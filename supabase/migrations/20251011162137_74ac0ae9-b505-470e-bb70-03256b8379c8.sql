-- Trigger pour historique des prix fournisseurs
CREATE OR REPLACE FUNCTION track_supplier_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Ajouter à l'historique si le prix a changé
  IF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price THEN
    -- Calculer le pourcentage de variation
    DECLARE
      variation_pct NUMERIC;
    BEGIN
      IF OLD.purchase_price > 0 THEN
        variation_pct := ROUND((NEW.purchase_price - OLD.purchase_price) / OLD.purchase_price * 100, 2);
      ELSE
        variation_pct := 100;
      END IF;
      
      -- Ajouter à l'historique JSON
      NEW.price_history := COALESCE(OLD.price_history, '[]'::jsonb) || 
        jsonb_build_object(
          'date', NOW(),
          'old_price', OLD.purchase_price,
          'new_price', NEW.purchase_price,
          'variation_pct', variation_pct,
          'supplier_id', NEW.supplier_id
        );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le trigger
DROP TRIGGER IF EXISTS on_supplier_price_variant_update ON supplier_price_variants;
CREATE TRIGGER on_supplier_price_variant_update
BEFORE UPDATE ON supplier_price_variants
FOR EACH ROW
EXECUTE FUNCTION track_supplier_price_change();