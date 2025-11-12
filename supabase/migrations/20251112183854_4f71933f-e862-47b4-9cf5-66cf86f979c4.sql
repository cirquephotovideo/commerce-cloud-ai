-- Add validation_status to product_amazon_links table
ALTER TABLE product_amazon_links 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'accepted', 'rejected'));

-- Add index for better performance when filtering by validation_status
CREATE INDEX IF NOT EXISTS idx_product_amazon_links_validation_status ON product_amazon_links(validation_status);

-- Add index for filtering pending links by user
CREATE INDEX IF NOT EXISTS idx_product_amazon_links_user_validation ON product_amazon_links(user_id, validation_status);