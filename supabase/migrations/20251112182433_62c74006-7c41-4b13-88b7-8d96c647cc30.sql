-- Create function to get Amazon links analytics by period
CREATE OR REPLACE FUNCTION public.get_amazon_links_analytics(
  p_user_id UUID,
  p_period TEXT DEFAULT 'all'
)
RETURNS TABLE(
  date DATE,
  links_created BIGINT,
  automatic_count BIGINT,
  manual_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(pal.created_at) as date,
    COUNT(*)::BIGINT as links_created,
    COUNT(*) FILTER (WHERE pal.link_type = 'automatic')::BIGINT as automatic_count,
    COUNT(*) FILTER (WHERE pal.link_type = 'manual')::BIGINT as manual_count
  FROM product_amazon_links pal
  WHERE pal.user_id = p_user_id
    AND pal.created_at >= CASE
      WHEN p_period = 'today' THEN CURRENT_DATE
      WHEN p_period = 'week' THEN CURRENT_DATE - INTERVAL '7 days'
      WHEN p_period = 'month' THEN CURRENT_DATE - INTERVAL '30 days'
      ELSE '1970-01-01'::DATE
    END
  GROUP BY DATE(pal.created_at)
  ORDER BY date DESC;
END;
$$;