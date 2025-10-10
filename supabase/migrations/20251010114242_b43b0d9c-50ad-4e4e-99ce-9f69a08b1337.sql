-- Add column_mapping to supplier_configurations for storing CSV/XLSX column mappings
ALTER TABLE supplier_configurations 
ADD COLUMN IF NOT EXISTS column_mapping JSONB DEFAULT NULL;

COMMENT ON COLUMN supplier_configurations.column_mapping IS 'JSON mapping of CSV/XLSX columns to product fields';
