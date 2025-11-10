-- Create function to get enrichment tasks with product details
CREATE OR REPLACE FUNCTION get_enrichment_tasks_with_products(
  user_id_param UUID,
  since_param TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  analysis_id UUID,
  supplier_product_id UUID,
  enrichment_type TEXT[],
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  user_id UUID,
  retry_count INTEGER,
  max_retries INTEGER,
  last_error TEXT,
  timeout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  product_name TEXT,
  product_ean TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.analysis_id,
    eq.supplier_product_id,
    eq.enrichment_type,
    eq.status,
    eq.priority,
    eq.created_at,
    eq.started_at,
    eq.completed_at,
    eq.error_message,
    eq.user_id,
    eq.retry_count,
    eq.max_retries,
    eq.last_error,
    eq.timeout_at,
    eq.updated_at,
    COALESCE(
      sp.product_name,
      pa.analysis_result->>'description',
      'Produit sans nom'
    ) as product_name,
    COALESCE(
      sp.ean,
      pa.ean
    ) as product_ean
  FROM enrichment_queue eq
  LEFT JOIN supplier_products sp ON eq.supplier_product_id = sp.id
  LEFT JOIN product_analyses pa ON eq.analysis_id = pa.id
  WHERE eq.user_id = user_id_param
    AND eq.created_at >= since_param
  ORDER BY eq.created_at DESC;
END;
$$ LANGUAGE plpgsql;