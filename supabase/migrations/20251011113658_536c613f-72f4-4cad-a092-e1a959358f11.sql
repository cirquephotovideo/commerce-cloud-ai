-- Add columns for mapping intelligence and preview
ALTER TABLE supplier_configurations
ADD COLUMN IF NOT EXISTS mapping_confidence JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_preview_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS preview_sample JSONB DEFAULT '[]'::jsonb;