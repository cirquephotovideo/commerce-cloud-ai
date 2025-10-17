-- Corriger le mapping SIDEV pour que brand pointe vers manu_name (index 6)
UPDATE supplier_configurations
SET mapping_config = jsonb_build_object(
  'supplier_reference', 0,
  'manufacturer_ref', 1,
  'purchase_price', 2,
  'stock_quantity', 3,
  'ean', 4,
  'product_name', 5,
  'brand', 6,
  'vat_rate', 7
)
WHERE id = 'f958eb2f-355a-41f9-90da-10df15d8a9e1';

-- Marquer les produits SIDEV existants comme nécessitant enrichissement
UPDATE supplier_products
SET additional_data = jsonb_set(
  COALESCE(additional_data, '{}'::jsonb),
  '{needs_enrichment}',
  'true'::jsonb
)
WHERE supplier_id = 'f958eb2f-355a-41f9-90da-10df15d8a9e1';