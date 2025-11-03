-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE supplier_products 
DROP CONSTRAINT IF EXISTS supplier_products_enrichment_status_check;

-- 2. Ajouter la nouvelle contrainte avec "skipped"
ALTER TABLE supplier_products 
ADD CONSTRAINT supplier_products_enrichment_status_check 
CHECK (enrichment_status IN ('pending', 'enriching', 'completed', 'failed', 'skipped'));

-- 3. Ajouter la colonne pour les messages d'erreur si elle n'existe pas
ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS enrichment_error_message TEXT;

-- 4. Créer un trigger pour synchroniser updated_at avec last_updated (rétrocompatibilité)
CREATE OR REPLACE FUNCTION sync_updated_at_with_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := COALESCE(NEW.last_updated, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_updated_at
BEFORE UPDATE ON supplier_products
FOR EACH ROW
EXECUTE FUNCTION sync_updated_at_with_last_updated();

-- 5. Index pour optimiser les requêtes sur le nouveau statut
CREATE INDEX IF NOT EXISTS idx_supplier_products_skipped 
ON supplier_products(enrichment_status) 
WHERE enrichment_status = 'skipped';