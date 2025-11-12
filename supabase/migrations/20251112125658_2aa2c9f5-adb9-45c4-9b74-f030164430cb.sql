-- Function to get enrichment summary for a supplier product
CREATE OR REPLACE FUNCTION public.get_product_enrichment_summary(p_supplier_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  analysis_id_var UUID;
BEGIN
  -- Get the linked analysis_id
  SELECT pa.id INTO analysis_id_var
  FROM product_analyses pa
  INNER JOIN product_links pl ON pa.id = pl.analysis_id
  WHERE pl.supplier_product_id = p_supplier_product_id
  LIMIT 1;
  
  IF analysis_id_var IS NULL THEN
    RETURN '{"total": 0, "items": {}}'::JSONB;
  END IF;
  
  -- Build enrichment summary
  SELECT JSONB_BUILD_OBJECT(
    'total', (
      (CASE WHEN specifications IS NOT NULL AND specifications != '{}'::JSONB THEN 1 ELSE 0 END) +
      (CASE WHEN long_description IS NOT NULL AND long_description != '' THEN 1 ELSE 0 END) +
      (CASE WHEN cost_analysis IS NOT NULL AND cost_analysis != '{}'::JSONB THEN 1 ELSE 0 END) +
      (CASE WHEN rsgp_compliance IS NOT NULL AND rsgp_compliance != '{}'::JSONB THEN 1 ELSE 0 END) +
      (SELECT COUNT(*)::INTEGER FROM amazon_product_data WHERE analysis_id = analysis_id_var) +
      (SELECT COUNT(*)::INTEGER FROM product_videos WHERE analysis_id = analysis_id_var AND status = 'completed')
    ),
    'items', JSONB_BUILD_OBJECT(
      'specs', specifications IS NOT NULL AND specifications != '{}'::JSONB,
      'description', long_description IS NOT NULL AND long_description != '',
      'cost', cost_analysis IS NOT NULL AND cost_analysis != '{}'::JSONB,
      'rsgp', rsgp_compliance IS NOT NULL AND rsgp_compliance != '{}'::JSONB,
      'amazon', (SELECT COUNT(*) FROM amazon_product_data WHERE analysis_id = analysis_id_var) > 0,
      'video', (SELECT COUNT(*) FROM product_videos WHERE analysis_id = analysis_id_var AND status = 'completed') > 0
    )
  ) INTO result
  FROM product_analyses
  WHERE id = analysis_id_var;
  
  RETURN COALESCE(result, '{"total": 0, "items": {}}'::JSONB);
END;
$$;