-- Add products_skipped column to import_jobs table
ALTER TABLE import_jobs 
ADD COLUMN IF NOT EXISTS products_skipped INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN import_jobs.products_skipped IS 'Number of products skipped during import (NC values, invalid data, etc.)';