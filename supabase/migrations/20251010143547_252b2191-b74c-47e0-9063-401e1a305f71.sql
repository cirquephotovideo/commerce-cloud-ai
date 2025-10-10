-- Étape 1: Supprimer les doublons en gardant le plus récent
DELETE FROM supplier_products
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, supplier_id, supplier_reference 
             ORDER BY created_at DESC
           ) AS rn
    FROM supplier_products
  ) t
  WHERE t.rn > 1
);

-- Étape 2: Ajouter la contrainte UNIQUE pour éviter les futurs doublons
ALTER TABLE supplier_products 
ADD CONSTRAINT supplier_products_user_supplier_ref_unique 
UNIQUE (user_id, supplier_id, supplier_reference);

-- Étape 3: Créer un index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_supplier_products_lookup 
ON supplier_products(user_id, supplier_id, supplier_reference);