-- Add counter columns to code2asin_import_chunks table
ALTER TABLE code2asin_import_chunks 
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_count INTEGER DEFAULT 0;

COMMENT ON COLUMN code2asin_import_chunks.success_count IS 'Number of successfully processed enrichments in this chunk';
COMMENT ON COLUMN code2asin_import_chunks.failed_count IS 'Number of failed enrichments in this chunk';
COMMENT ON COLUMN code2asin_import_chunks.created_count IS 'Number of new product_analyses created in this chunk';
COMMENT ON COLUMN code2asin_import_chunks.updated_count IS 'Number of existing product_analyses updated in this chunk';