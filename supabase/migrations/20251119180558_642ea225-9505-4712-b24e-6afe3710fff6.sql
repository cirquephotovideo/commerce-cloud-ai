-- Fix merge_supplier_data_on_link to remove non-existent brand and category columns
CREATE OR REPLACE FUNCTION public.merge_supplier_data_on_link()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  supplier_data RECORD;
BEGIN
  -- Fetch only existing columns from supplier_products
  SELECT 
    product_name,
    purchase_price,
    stock_quantity,
    supplier_reference
  INTO supplier_data
  FROM supplier_products
  WHERE id = NEW.supplier_product_id;
  
  -- Merge into product_analyses (removed brand and category)
  UPDATE product_analyses
  SET
    analysis_result = COALESCE(analysis_result, '{}'::jsonb) || 
      jsonb_build_object(
        'name', COALESCE(analysis_result->>'name', supplier_data.product_name),
        'supplier_reference', supplier_data.supplier_reference
      ),
    cost_analysis = COALESCE(cost_analysis, '{}'::jsonb) ||
      jsonb_build_object(
        'purchase_price', supplier_data.purchase_price
      ),
    odoo_attributes = COALESCE(odoo_attributes, '{}'::jsonb) ||
      jsonb_build_object(
        'stock_quantity', supplier_data.stock_quantity
      ),
    updated_at = NOW()
  WHERE id = NEW.analysis_id
    AND (
      analysis_result->>'name' IS NULL 
      OR analysis_result->>'name' = '' 
      OR analysis_result->>'name' = 'Produit sans nom'
    );
  
  RETURN NEW;
END;
$$;

-- Fix merge_existing_links to remove brand/category from supplier products
CREATE OR REPLACE FUNCTION public.merge_existing_links()
RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  supplier_links_merged INTEGER := 0;
  amazon_links_merged INTEGER := 0;
BEGIN
  -- Merge existing supplier links (removed brand and category)
  WITH updated_supplier AS (
    UPDATE product_analyses pa
    SET
      analysis_result = COALESCE(pa.analysis_result, '{}'::jsonb) || 
        jsonb_build_object(
          'name', COALESCE(pa.analysis_result->>'name', sp.product_name),
          'supplier_reference', sp.supplier_reference
        ),
      cost_analysis = COALESCE(pa.cost_analysis, '{}'::jsonb) ||
        jsonb_build_object(
          'purchase_price', sp.purchase_price
        ),
      odoo_attributes = COALESCE(pa.odoo_attributes, '{}'::jsonb) ||
        jsonb_build_object(
          'stock_quantity', sp.stock_quantity
        ),
      updated_at = NOW()
    FROM product_links pl
    INNER JOIN supplier_products sp ON pl.supplier_product_id = sp.id
    WHERE pa.id = pl.analysis_id
      AND (
        pa.analysis_result->>'name' IS NULL 
        OR pa.analysis_result->>'name' = '' 
        OR pa.analysis_result->>'name' = 'Produit sans nom'
      )
    RETURNING pa.id
  )
  SELECT COUNT(*) INTO supplier_links_merged FROM updated_supplier;
  
  -- Merge Amazon links (unchanged - brand exists in code2asin_enrichments)
  WITH updated_amazon AS (
    UPDATE product_analyses pa
    SET
      analysis_result = COALESCE(pa.analysis_result, '{}'::jsonb) || 
        jsonb_build_object(
          'name', COALESCE(pa.analysis_result->>'name', ce.title),
          'brand', COALESCE(pa.analysis_result->>'brand', ce.brand),
          'amazon_asin', ce.asin
        ),
      specifications = COALESCE(pa.specifications, '{}'::jsonb) ||
        CASE 
          WHEN ce.features IS NOT NULL THEN
            jsonb_build_object('amazon_features', ce.features)
          ELSE '{}'::jsonb
        END,
      cost_analysis = COALESCE(pa.cost_analysis, '{}'::jsonb) ||
        jsonb_build_object(
          'amazon_buybox_price', ce.buybox_price,
          'amazon_list_price', ce.list_price
        ),
      official_image_urls = CASE
        WHEN ce.image_urls IS NOT NULL THEN
          COALESCE(pa.official_image_urls, ARRAY[]::text[]) || 
          ARRAY(SELECT jsonb_array_elements_text(ce.image_urls))
        ELSE pa.official_image_urls
      END,
      hs_code = COALESCE(pa.hs_code, ce.product_type),
      ean = COALESCE(pa.ean, ce.ean),
      updated_at = NOW()
    FROM product_amazon_links pal
    INNER JOIN code2asin_enrichments ce ON pal.enrichment_id = ce.id
    WHERE pa.id = pal.analysis_id
    RETURNING pa.id
  )
  SELECT COUNT(*) INTO amazon_links_merged FROM updated_amazon;
  
  RETURN jsonb_build_object(
    'success', true,
    'supplier_links_merged', supplier_links_merged,
    'amazon_links_merged', amazon_links_merged,
    'timestamp', NOW()
  );
END;
$$;