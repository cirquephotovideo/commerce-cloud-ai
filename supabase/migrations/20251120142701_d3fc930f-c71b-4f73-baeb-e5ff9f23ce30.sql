-- Step 1: Clean duplicate entries in supplier_price_variants
-- Keep only the most recent entry for each (analysis_id, supplier_product_id) pair
DELETE FROM supplier_price_variants spv1
WHERE spv1.id IN (
  SELECT spv2.id
  FROM supplier_price_variants spv2
  INNER JOIN (
    SELECT 
      analysis_id,
      supplier_product_id,
      MAX(last_updated) as max_updated
    FROM supplier_price_variants
    WHERE analysis_id IS NOT NULL 
      AND supplier_product_id IS NOT NULL
    GROUP BY analysis_id, supplier_product_id
    HAVING COUNT(*) > 1
  ) dups ON spv2.analysis_id = dups.analysis_id 
         AND spv2.supplier_product_id = dups.supplier_product_id
  WHERE spv2.last_updated < dups.max_updated
);

-- Step 2: Delete rows with NULL values
DELETE FROM supplier_price_variants
WHERE analysis_id IS NULL OR supplier_product_id IS NULL;

-- Step 3: Drop old incorrect UNIQUE constraint
ALTER TABLE supplier_price_variants
DROP CONSTRAINT IF EXISTS supplier_price_variants_analysis_id_supplier_id_key;

-- Step 4: Add correct UNIQUE constraint
ALTER TABLE supplier_price_variants
ADD CONSTRAINT supplier_price_variants_analysis_id_supplier_product_id_key 
UNIQUE (analysis_id, supplier_product_id);

-- Step 5: Make columns NOT NULL
ALTER TABLE supplier_price_variants
ALTER COLUMN analysis_id SET NOT NULL,
ALTER COLUMN supplier_product_id SET NOT NULL;