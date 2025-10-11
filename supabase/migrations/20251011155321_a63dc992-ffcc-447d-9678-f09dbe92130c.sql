-- Ajouter une contrainte unique sur (supplier_id, supplier_reference)
-- pour permettre les upserts dans supplier_products
ALTER TABLE supplier_products 
ADD CONSTRAINT supplier_products_supplier_id_supplier_reference_key 
UNIQUE (supplier_id, supplier_reference);