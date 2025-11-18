-- Add columns for web sources and confidence level tracking
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS web_sources jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS confidence_level text CHECK (confidence_level IN ('high', 'medium', 'low'));

-- Index for better search performance
CREATE INDEX IF NOT EXISTS idx_product_analyses_confidence 
ON product_analyses(confidence_level);

-- Comments for documentation
COMMENT ON COLUMN product_analyses.web_sources IS 'URLs des sources web utilisées lors de l''enrichissement';
COMMENT ON COLUMN product_analyses.confidence_level IS 'Niveau de confiance de l''enrichissement (high/medium/low)';