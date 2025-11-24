-- ============================================================
-- Phase 1 Optimization: Composite Index for Product Analyses
-- ============================================================
-- Purpose: Optimize EAN-based upsert queries in email-import-chunk
-- Expected gain: -15% latency on product lookups by user+EAN
-- ============================================================

-- Create composite index on (user_id, ean) for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_ean 
ON product_analyses (user_id, ean) 
WHERE ean IS NOT NULL AND ean != '';

-- Add index on normalized_ean for faster matching
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_normalized_ean
ON product_analyses (user_id, normalized_ean)
WHERE normalized_ean IS NOT NULL;

-- Analyze tables to update query planner statistics
ANALYZE product_analyses;
ANALYZE supplier_products;