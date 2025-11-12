-- Drop the problematic trigger and function with CASCADE to remove dependencies
DROP TRIGGER IF EXISTS track_supplier_price_changes ON supplier_products CASCADE;
DROP TRIGGER IF EXISTS on_supplier_price_variant_update ON supplier_price_variants CASCADE;
DROP FUNCTION IF EXISTS track_supplier_price_change() CASCADE;

-- Create optimized batch function for enrichment summaries
CREATE OR REPLACE FUNCTION get_products_enrichment_batch(p_product_ids UUID[])
RETURNS TABLE(
  product_id UUID,
  enrichment_summary JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.supplier_product_id AS product_id,
    JSONB_BUILD_OBJECT(
      'total', (
        (CASE WHEN pa.specifications IS NOT NULL AND pa.specifications != '{}'::JSONB THEN 1 ELSE 0 END) +
        (CASE WHEN pa.long_description IS NOT NULL AND pa.long_description != '' THEN 1 ELSE 0 END) +
        (CASE WHEN pa.cost_analysis IS NOT NULL AND pa.cost_analysis != '{}'::JSONB THEN 1 ELSE 0 END) +
        (CASE WHEN pa.rsgp_compliance IS NOT NULL AND pa.rsgp_compliance != '{}'::JSONB THEN 1 ELSE 0 END) +
        COALESCE((SELECT COUNT(*)::INTEGER FROM amazon_product_data WHERE analysis_id = pa.id), 0) +
        COALESCE((SELECT COUNT(*)::INTEGER FROM product_videos WHERE analysis_id = pa.id AND status = 'completed'), 0)
      ),
      'items', JSONB_BUILD_OBJECT(
        'specs', pa.specifications IS NOT NULL AND pa.specifications != '{}'::JSONB,
        'description', pa.long_description IS NOT NULL AND pa.long_description != '',
        'cost', pa.cost_analysis IS NOT NULL AND pa.cost_analysis != '{}'::JSONB,
        'rsgp', pa.rsgp_compliance IS NOT NULL AND pa.rsgp_compliance != '{}'::JSONB,
        'amazon', (SELECT COUNT(*) FROM amazon_product_data WHERE analysis_id = pa.id) > 0,
        'video', (SELECT COUNT(*) FROM product_videos WHERE analysis_id = pa.id AND status = 'completed') > 0
      )
    ) AS enrichment_summary
  FROM product_links pl
  INNER JOIN product_analyses pa ON pl.analysis_id = pa.id
  WHERE pl.supplier_product_id = ANY(p_product_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;