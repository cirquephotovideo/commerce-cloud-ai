-- Add skip_rows column to supplier_configurations for smart header detection
ALTER TABLE supplier_configurations
ADD COLUMN IF NOT EXISTS skip_rows INTEGER DEFAULT 0;

COMMENT ON COLUMN supplier_configurations.skip_rows IS 
'Number of rows to skip before headers (0 = automatic detection). Useful for files with title rows, legends, or empty lines before actual data headers.';