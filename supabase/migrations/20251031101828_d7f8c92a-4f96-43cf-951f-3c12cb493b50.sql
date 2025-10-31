-- Add is_active column to price_monitoring table
ALTER TABLE price_monitoring 
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN price_monitoring.is_active IS 'Indicates if price monitoring is active for this product';

-- Create partial index for active monitorings (better performance)
CREATE INDEX idx_price_monitoring_active 
ON price_monitoring(user_id, is_active, scraped_at DESC) 
WHERE is_active = true;

-- Update existing records to be active by default
UPDATE price_monitoring SET is_active = true WHERE is_active IS NULL;