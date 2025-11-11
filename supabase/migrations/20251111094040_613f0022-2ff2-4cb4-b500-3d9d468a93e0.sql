-- Add indexes to optimize enrichment queue queries
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_user_created 
  ON enrichment_queue(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_analysis_id 
  ON enrichment_queue(analysis_id) WHERE analysis_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_supplier_product_id 
  ON enrichment_queue(supplier_product_id) WHERE supplier_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_id_ean 
  ON supplier_products(id, ean, product_name);

CREATE INDEX IF NOT EXISTS idx_product_analyses_id_ean 
  ON product_analyses(id, ean);

-- Optimize the RPC function to limit results and improve performance
CREATE OR REPLACE FUNCTION public.get_enrichment_tasks_with_products(
  user_id_param uuid,
  since_param timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  analysis_id uuid,
  supplier_product_id uuid,
  enrichment_type text[],
  status text,
  priority text,
  created_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  user_id uuid,
  retry_count integer,
  max_retries integer,
  last_error text,
  timeout_at timestamp with time zone,
  updated_at timestamp with time zone,
  product_name text,
  product_ean text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ORDER BY eq.created_at DESC
  LIMIT 100;
END;
$function$