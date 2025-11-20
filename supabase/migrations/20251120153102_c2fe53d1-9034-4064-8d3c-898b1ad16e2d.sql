-- Fonction pour synchroniser les supplier_price_variants pour une analyse spécifique
CREATE OR REPLACE FUNCTION sync_supplier_price_variants_for_analysis(p_analysis_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  variants_synced INTEGER := 0;
BEGIN
  -- Insérer ou mettre à jour les variants à partir des product_links
  WITH variants_to_sync AS (
    INSERT INTO supplier_price_variants (
      analysis_id,
      supplier_id,
      supplier_product_id,
      purchase_price,
      stock_quantity,
      currency,
      user_id,
      last_updated
    )
    SELECT 
      pl.analysis_id,
      sp.supplier_id,
      sp.id,
      sp.purchase_price,
      sp.stock_quantity,
      'EUR',
      pl.user_id,
      NOW()
    FROM product_links pl
    INNER JOIN supplier_products sp ON pl.supplier_product_id = sp.id
    WHERE pl.analysis_id = p_analysis_id
    ON CONFLICT (analysis_id, supplier_product_id) 
    DO UPDATE SET
      purchase_price = EXCLUDED.purchase_price,
      stock_quantity = EXCLUDED.stock_quantity,
      supplier_id = EXCLUDED.supplier_id,
      last_updated = NOW()
    RETURNING *
  )
  SELECT COUNT(*)::INTEGER INTO variants_synced FROM variants_to_sync;
  
  RETURN jsonb_build_object(
    'success', true,
    'variants_synced', variants_synced,
    'analysis_id', p_analysis_id
  );
END;
$$;