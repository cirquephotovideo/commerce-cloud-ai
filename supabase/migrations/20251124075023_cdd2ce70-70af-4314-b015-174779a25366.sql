-- ============================================================
-- Fix: Add Index for Quality Report Performance
-- ============================================================
-- Purpose: Optimize quality report queries without blocking refresh
-- ============================================================

-- Add index on created_at for faster quality report queries
CREATE INDEX IF NOT EXISTS idx_product_analyses_created_at 
ON product_analyses(created_at DESC);

-- Add index on updated_at for enrichment time calculations
CREATE INDEX IF NOT EXISTS idx_product_analyses_updated_at
ON product_analyses(updated_at DESC);