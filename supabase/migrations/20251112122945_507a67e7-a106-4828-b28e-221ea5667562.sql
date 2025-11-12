-- Fonction pour récupérer le flux d'imports par minute (dernière heure)
CREATE OR REPLACE FUNCTION get_import_flow_by_minute(p_user_id UUID)
RETURNS TABLE(
  minute TIMESTAMP WITH TIME ZONE,
  products_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as products_count
  FROM supplier_products
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY DATE_TRUNC('minute', created_at)
  ORDER BY minute ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;