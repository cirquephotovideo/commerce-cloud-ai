-- Add retry_count column to code2asin_import_chunks
ALTER TABLE code2asin_import_chunks 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;