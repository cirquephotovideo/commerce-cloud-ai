-- Activer supports_import pour toutes les plateformes compatibles
UPDATE platform_configurations
SET supports_import = true
WHERE platform_type IN ('odoo', 'prestashop', 'shopify', 'woocommerce', 'magento', 'sap', 'salesforce', 'uber_eats', 'deliveroo', 'just_eat', 'windev')
  AND supports_import IS NOT true;