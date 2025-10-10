-- Drop the old constraint
ALTER TABLE platform_configurations DROP CONSTRAINT IF EXISTS platform_configurations_platform_type_check;

-- Add new constraint with all supported platforms
ALTER TABLE platform_configurations ADD CONSTRAINT platform_configurations_platform_type_check 
CHECK (platform_type IN (
  'shopify',
  'woocommerce', 
  'prestashop',
  'magento',
  'odoo',
  'salesforce',
  'sap',
  'uber_eats',
  'deliveroo',
  'just_eat',
  'windev'
));