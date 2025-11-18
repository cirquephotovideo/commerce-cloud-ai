-- Partie 1: Nettoyer les jobs bloqués Amazon
UPDATE amazon_auto_link_jobs
SET 
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Timeout: job bloqué depuis plus de 24 heures - nettoyage automatique'
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '24 hours'
  AND completed_at IS NULL;

-- Partie 2: Fonction de fusion des données fournisseur
CREATE OR REPLACE FUNCTION merge_supplier_data_on_link()
RETURNS TRIGGER AS $$
DECLARE
  supplier_data RECORD;
BEGIN
  -- Récupérer les données du produit fournisseur
  SELECT 
    product_name,
    purchase_price,
    stock_quantity,
    supplier_reference,
    brand,
    category
  INTO supplier_data
  FROM supplier_products
  WHERE id = NEW.supplier_product_id;
  
  -- Fusionner dans product_analyses
  UPDATE product_analyses
  SET
    analysis_result = COALESCE(analysis_result, '{}'::jsonb) || 
      jsonb_build_object(
        'name', COALESCE(analysis_result->>'name', supplier_data.product_name),
        'supplier_reference', supplier_data.supplier_reference,
        'brand', COALESCE(analysis_result->>'brand', supplier_data.brand),
        'category', COALESCE(analysis_result->>'category', supplier_data.category)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour fusion automatique fournisseur
DROP TRIGGER IF EXISTS trigger_merge_supplier_data ON product_links;
CREATE TRIGGER trigger_merge_supplier_data
AFTER INSERT ON product_links
FOR EACH ROW
EXECUTE FUNCTION merge_supplier_data_on_link();

-- Partie 3: Fonction de fusion des données Amazon
CREATE OR REPLACE FUNCTION merge_amazon_data_on_link()
RETURNS TRIGGER AS $$
DECLARE
  amazon_data RECORD;
BEGIN
  -- Récupérer les données de l'enrichissement Amazon
  SELECT 
    title,
    brand,
    image_urls,
    features,
    buybox_price,
    list_price,
    asin,
    ean,
    product_type as hs_code
  INTO amazon_data
  FROM code2asin_enrichments
  WHERE id = NEW.enrichment_id;
  
  -- Fusionner dans product_analyses
  UPDATE product_analyses
  SET
    analysis_result = COALESCE(analysis_result, '{}'::jsonb) || 
      jsonb_build_object(
        'name', COALESCE(analysis_result->>'name', amazon_data.title),
        'brand', COALESCE(analysis_result->>'brand', amazon_data.brand),
        'amazon_asin', amazon_data.asin
      ),
    specifications = COALESCE(specifications, '{}'::jsonb) ||
      CASE 
        WHEN amazon_data.features IS NOT NULL THEN
          jsonb_build_object('amazon_features', amazon_data.features)
        ELSE '{}'::jsonb
      END,
    cost_analysis = COALESCE(cost_analysis, '{}'::jsonb) ||
      jsonb_build_object(
        'amazon_buybox_price', amazon_data.buybox_price,
        'amazon_list_price', amazon_data.list_price
      ),
    official_image_urls = CASE
      WHEN amazon_data.image_urls IS NOT NULL THEN
        COALESCE(official_image_urls, ARRAY[]::text[]) || 
        ARRAY(SELECT jsonb_array_elements_text(amazon_data.image_urls))
      ELSE official_image_urls
    END,
    hs_code = COALESCE(hs_code, amazon_data.hs_code),
    ean = COALESCE(ean, amazon_data.ean),
    updated_at = NOW()
  WHERE id = NEW.analysis_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour fusion automatique Amazon
DROP TRIGGER IF EXISTS trigger_merge_amazon_data ON product_amazon_links;
CREATE TRIGGER trigger_merge_amazon_data
AFTER INSERT ON product_amazon_links
FOR EACH ROW
EXECUTE FUNCTION merge_amazon_data_on_link();

-- Partie 4: Fonction de fusion manuelle rétroactive
CREATE OR REPLACE FUNCTION merge_existing_links()
RETURNS jsonb AS $$
DECLARE
  supplier_links_merged INTEGER := 0;
  amazon_links_merged INTEGER := 0;
BEGIN
  -- Fusionner les liens fournisseurs existants
  WITH updated_supplier AS (
    UPDATE product_analyses pa
    SET
      analysis_result = COALESCE(pa.analysis_result, '{}'::jsonb) || 
        jsonb_build_object(
          'name', COALESCE(pa.analysis_result->>'name', sp.product_name),
          'supplier_reference', sp.supplier_reference,
          'brand', COALESCE(pa.analysis_result->>'brand', sp.brand),
          'category', COALESCE(pa.analysis_result->>'category', sp.category)
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
  
  -- Fusionner les liens Amazon existants
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON FUNCTION merge_supplier_data_on_link() IS 'Fusionne automatiquement les données fournisseur dans product_analyses lors de la création d''un lien';
COMMENT ON FUNCTION merge_amazon_data_on_link() IS 'Fusionne automatiquement les données Amazon dans product_analyses lors de la création d''un lien';
COMMENT ON FUNCTION merge_existing_links() IS 'Fusionne rétroactivement tous les liens existants (supplier + Amazon) dans product_analyses';