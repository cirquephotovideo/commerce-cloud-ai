-- Phase 1: Add column_mapping to supplier_configurations
ALTER TABLE supplier_configurations 
ADD COLUMN IF NOT EXISTS column_mapping JSONB DEFAULT NULL;

COMMENT ON COLUMN supplier_configurations.column_mapping IS 'AI-detected or user-defined column mapping for file imports';