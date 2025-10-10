-- Add description and needs_enrichment columns to supplier_products
ALTER TABLE supplier_products 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS needs_enrichment BOOLEAN DEFAULT false;

-- Mark existing products with truncated descriptions for enrichment
UPDATE supplier_products
SET needs_enrichment = true
WHERE 
  description IS NOT NULL AND (
    description LIKE '%...' 
    OR description LIKE '%jusqu&%'
    OR description LIKE '%jusqu''&%'
    OR length(description) < 50
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_supplier_products_needs_enrichment 
ON supplier_products(needs_enrichment) 
WHERE needs_enrichment = true;