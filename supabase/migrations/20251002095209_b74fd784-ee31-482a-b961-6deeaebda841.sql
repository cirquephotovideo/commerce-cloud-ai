-- Add new columns to product_analyses for detailed competitive analysis
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS description_long TEXT,
ADD COLUMN IF NOT EXISTS competitive_pros JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS competitive_cons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS use_cases JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS market_position TEXT;

-- Add new columns to price_monitoring for trend analysis
ALTER TABLE price_monitoring
ADD COLUMN IF NOT EXISTS price_trend NUMERIC,
ADD COLUMN IF NOT EXISTS availability_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS best_deal_score NUMERIC;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_created ON product_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_monitoring_user_scraped ON price_monitoring(user_id, scraped_at DESC);