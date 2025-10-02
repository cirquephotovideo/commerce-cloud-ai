-- Add columns to price_monitoring for dual-engine tracking
ALTER TABLE price_monitoring 
ADD COLUMN IF NOT EXISTS search_engine TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS search_metadata JSONB DEFAULT '{}'::jsonb;

-- Create price_history table to track price changes over time
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_monitoring_id UUID NOT NULL REFERENCES price_monitoring(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  price NUMERIC NOT NULL,
  stock_status TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT, -- 'google' | 'serper' | 'dual'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on price_history
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for price_history
CREATE POLICY "Users can view their own price history"
ON price_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price history"
ON price_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to track price changes
CREATE OR REPLACE FUNCTION public.track_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into history only if price has changed
  IF NEW.current_price IS DISTINCT FROM OLD.current_price THEN
    INSERT INTO price_history (price_monitoring_id, user_id, price, stock_status, source)
    VALUES (NEW.id, NEW.user_id, NEW.current_price, NEW.stock_status, NEW.search_engine);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic price change tracking
DROP TRIGGER IF EXISTS price_change_tracker ON price_monitoring;
CREATE TRIGGER price_change_tracker
AFTER UPDATE ON price_monitoring
FOR EACH ROW
EXECUTE FUNCTION public.track_price_change();