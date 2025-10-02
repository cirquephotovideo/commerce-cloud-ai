import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OdooConfig {
  odoo_url: string;
  database_name: string;
  username: string;
  password_encrypted: string;
}

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  image_urls?: string[];
  mapped_category_id?: string;
  tags?: string[];
  odoo_attributes?: any;
}

// Authenticate with Odoo using XML-RPC
async function authenticateOdoo(config: OdooConfig): Promise<number> {
  const xmlrpcPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${config.database_name}</string></value></param>
    <param><value><string>${config.username}</string></value></param>
    <param><value><string>${config.password_encrypted}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

  const response = await fetch(`${config.odoo_url}/xmlrpc/2/common`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlrpcPayload,
  });

  const text = await response.text();
  const uidMatch = text.match(/<int>(\d+)<\/int>/);
  if (!uidMatch) throw new Error('Authentication failed');
  return parseInt(uidMatch[1]);
}

// Create product in Odoo with full Odoo 19 mapping
async function createOdooProduct(
  config: OdooConfig,
  uid: number,
  productData: any
): Promise<{ success: boolean; error?: string; product_id?: number }> {
  try {
    // Build the product struct XML with all Odoo 19 fields
    let productStruct = `
        <member><name>name</name><value><string>${escapeXml(productData.name || '')}</string></value></member>
        <member><name>description</name><value><string>${escapeXml(productData.description || '')}</string></value></member>
        <member><name>description_sale</name><value><string>${escapeXml(productData.description_sale || '')}</string></value></member>
        <member><name>list_price</name><value><double>${productData.list_price || 0}</double></value></member>
        <member><name>standard_price</name><value><double>${productData.standard_price || 0}</double></value></member>
        <member><name>default_code</name><value><string>${escapeXml(productData.default_code || '')}</string></value></member>
        <member><name>barcode</name><value><string>${escapeXml(productData.barcode || '')}</string></value></member>
        <member><name>sale_ok</name><value><boolean>1</boolean></value></member>
        <member><name>purchase_ok</name><value><boolean>0</boolean></value></member>
        <member><name>type</name><value><string>consu</string></value></member>
        <member><name>website_published</name><value><boolean>1</boolean></value></member>`;

    // Add category if available
    if (productData.categ_id) {
      productStruct += `<member><name>categ_id</name><value><int>${productData.categ_id}</int></value></member>`;
    }

    // Add SEO fields
    if (productData.website_meta_title) {
      productStruct += `<member><name>website_meta_title</name><value><string>${escapeXml(productData.website_meta_title)}</string></value></member>`;
    }
    if (productData.website_meta_description) {
      productStruct += `<member><name>website_meta_description</name><value><string>${escapeXml(productData.website_meta_description)}</string></value></member>`;
    }
    if (productData.website_meta_keywords) {
      productStruct += `<member><name>website_meta_keywords</name><value><string>${escapeXml(productData.website_meta_keywords)}</string></value></member>`;
    }

    // Add main image if available
    if (productData.image_1920) {
      productStruct += `<member><name>image_1920</name><value><string>${productData.image_1920}</string></value></member>`;
    }

    // Add weight and volume if available
    if (productData.weight) {
      productStruct += `<member><name>weight</name><value><double>${productData.weight}</double></value></member>`;
    }
    if (productData.volume) {
      productStruct += `<member><name>volume</name><value><double>${productData.volume}</double></value></member>`;
    }

    const xmlrpcPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${config.database_name}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${config.password_encrypted}</string></value></param>
    <param><value><string>product.template</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>${productStruct}</struct></value>
    </data></array></value></param>
  </params>
</methodCall>`;

    const response = await fetch(`${config.odoo_url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xmlrpcPayload,
    });

    const text = await response.text();
    const productIdMatch = text.match(/<int>(\d+)<\/int>/);
    
    if (productIdMatch) {
      return { success: true, product_id: parseInt(productIdMatch[1]) };
    } else {
      return { success: false, error: 'Failed to extract product ID from response' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to escape XML special characters
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper to download image and convert to base64
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

// Helper to get nested value from object using path
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Create additional product images in Odoo
async function createProductImages(
  config: OdooConfig,
  uid: number,
  productTemplateId: number,
  imageUrls: string[]
): Promise<{ success: number; failed: number }> {
  let successCount = 0;
  let failedCount = 0;

  for (const imageUrl of imageUrls) {
    try {
      console.log(`Downloading additional image: ${imageUrl}`);
      const imageBase64 = await downloadImageAsBase64(imageUrl);
      
      if (!imageBase64) {
        failedCount++;
        continue;
      }

      const imageStruct = `
        <member><name>name</name><value><string>Product Image</string></value></member>
        <member><name>image_1920</name><value><string>${imageBase64}</string></value></member>
        <member><name>product_tmpl_id</name><value><int>${productTemplateId}</int></value></member>`;

      const xmlrpcPayload = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${config.database_name}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${config.password_encrypted}</string></value></param>
    <param><value><string>product.image</string></value></param>
    <param><value><string>create</string></value></param>
    <param><value><array><data>
      <value><struct>${imageStruct}</struct></value>
    </data></array></value></param>
  </params>
</methodCall>`;

      const response = await fetch(`${config.odoo_url}/xmlrpc/2/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlrpcPayload,
      });

      const text = await response.text();
      const imageIdMatch = text.match(/<int>(\d+)<\/int>/);
      
      if (imageIdMatch) {
        successCount++;
        console.log(`✓ Additional image created with ID: ${imageIdMatch[1]}`);
      } else {
        failedCount++;
        console.log(`✗ Failed to create additional image`);
      }
    } catch (error) {
      failedCount++;
      console.error('Error creating product image:', error);
    }
  }

  return { success: successCount, failed: failedCount };
}

// Map analysis result to Odoo product data using custom mappings
async function mapAnalysisToOdooProduct(
  analysis: ProductAnalysis, 
  categories: any[],
  fieldMappings: any[]
): Promise<any> {
  const result = analysis.analysis_result;
  
  // Start with default essential fields
  const productData: any = {
    sale_ok: true,
    purchase_ok: false,
    type: 'consu',
    website_published: true,
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    if (!mapping.is_active) continue;

    let value = null;

    // Get value from source path
    if (mapping.source_path.includes('.')) {
      value = getNestedValue(result, mapping.source_path);
    } else {
      // Direct field access
      if (mapping.source_path === 'product_name') {
        value = result.product_name || analysis.product_url;
      }
    }

    // Apply transformations based on field type
    if (value !== null && value !== undefined) {
      if (mapping.odoo_field === 'list_price' || mapping.odoo_field === 'standard_price') {
        // Price transformation
        if (typeof value === 'string') {
          const priceStr = value.replace(/[^0-9.,]/g, '');
          value = parseFloat(priceStr.replace(',', '.')) || 0;
          if (mapping.odoo_field === 'standard_price') {
            value = value * 0.7; // Estimate cost at 70% of selling price
          }
        }
      } else if (mapping.odoo_field === 'website_meta_keywords' && Array.isArray(value)) {
        // Keywords array to string
        value = value.join(', ');
      } else if (mapping.odoo_field === 'description_sale') {
        // Truncate description_sale
        value = String(value).substring(0, 500);
      }

      productData[mapping.odoo_field] = value;
    }
  }

  // Extract rich data from analysis_result
  // Product name - prioritize product_name from analysis_result
  if (!productData.name) {
    productData.name = result.product_name || result.title || analysis.product_url;
  }

  // Description - use suggested_description if available
  if (!productData.description && result.suggested_description) {
    productData.description = result.suggested_description;
  }

  // Description sale - combine key features if available
  if (!productData.description_sale) {
    let descriptionSale = '';
    if (result.key_features && Array.isArray(result.key_features)) {
      descriptionSale = result.key_features.join('\n• ');
      if (descriptionSale) descriptionSale = '• ' + descriptionSale;
    }
    if (result.suggested_description) {
      descriptionSale = result.suggested_description + '\n\n' + descriptionSale;
    }
    if (descriptionSale) {
      productData.description_sale = descriptionSale.substring(0, 2000);
    }
  }

  // Price - extract from various possible locations
  if (!productData.list_price) {
    let price = null;
    if (result.price) {
      if (typeof result.price === 'string') {
        const priceStr = result.price.replace(/[^0-9.,]/g, '');
        price = parseFloat(priceStr.replace(',', '.')) || 0;
      } else if (typeof result.price === 'number') {
        price = result.price;
      }
    } else if (result.pricing?.current_price) {
      price = result.pricing.current_price;
    }
    if (price) {
      productData.list_price = price;
      if (!productData.standard_price) {
        productData.standard_price = price * 0.7;
      }
    }
  }

  // Default code / Reference
  if (!productData.default_code) {
    const barcode = analysis.product_url.match(/^\d{8,13}$/) ? analysis.product_url : '';
    productData.default_code = barcode || result.sku || result.reference || `REF-${Date.now()}`;
  }

  // Barcode / EAN
  if (!productData.barcode && result.ean) {
    productData.barcode = result.ean;
  }

  // SEO Meta data
  if (!productData.website_meta_title && result.product_name) {
    productData.website_meta_title = result.product_name.substring(0, 60);
  }
  if (!productData.website_meta_description) {
    const metaDesc = result.suggested_description || result.description || '';
    productData.website_meta_description = metaDesc.substring(0, 160);
  }
  if (!productData.website_meta_keywords) {
    const keywords = [];
    if (result.tags && Array.isArray(result.tags)) {
      keywords.push(...result.tags);
    }
    if (result.tags_categories?.all_tags && Array.isArray(result.tags_categories.all_tags)) {
      keywords.push(...result.tags_categories.all_tags);
    }
    if (analysis.tags && Array.isArray(analysis.tags)) {
      keywords.push(...analysis.tags);
    }
    if (keywords.length > 0) {
      productData.website_meta_keywords = [...new Set(keywords)].join(', ').substring(0, 255);
    }
  }

  // Handle category mapping
  let categId = null;
  if (analysis.mapped_category_id) {
    const category = categories.find(c => c.odoo_category_id === parseInt(analysis.mapped_category_id!));
    if (category) {
      categId = category.odoo_category_id;
    }
  }
  if (!categId && result.tags_categories?.primary_category) {
    const categoryMatch = categories.find(c => 
      c.category_name.toLowerCase().includes(result.tags_categories.primary_category.toLowerCase()) ||
      c.full_path.toLowerCase().includes(result.tags_categories.primary_category.toLowerCase())
    );
    if (categoryMatch) {
      categId = categoryMatch.odoo_category_id;
    }
  }
  if (categId) {
    productData.categ_id = categId;
  }

  // Download and convert first image to base64 if available
  let imageBase64 = null;
  if (analysis.image_urls && analysis.image_urls.length > 0) {
    console.log(`Downloading main image from: ${analysis.image_urls[0]}`);
    imageBase64 = await downloadImageAsBase64(analysis.image_urls[0]);
    if (imageBase64) {
      productData.image_1920 = imageBase64;
    }
  }

  return productData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    console.log('[EXPORT-ODOO] Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[EXPORT-ODOO] Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing authorization header' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[EXPORT-ODOO] User verification failed:', userError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized or expired session' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('[EXPORT-ODOO] Authenticated user:', user.id);

    const { analysisIds } = await req.json();

    if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length === 0) {
      throw new Error('No analysis IDs provided');
    }

    console.log(`Exporting ${analysisIds.length} products to Odoo for user ${user.id}`);

    // Get Odoo configuration
    const { data: config, error: configError } = await supabase
      .from('odoo_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('No active Odoo configuration found. Please configure Odoo settings first.');
    }

    // Get cached Odoo categories
    const { data: categories } = await supabase
      .from('odoo_categories')
      .select('*')
      .eq('user_id', user.id);

    // Get custom field mappings
    const { data: fieldMappings } = await supabase
      .from('odoo_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Get analyses
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('*')
      .in('id', analysisIds)
      .eq('user_id', user.id);

    if (analysesError || !analyses) {
      throw new Error('Failed to fetch product analyses');
    }

    // Authenticate with Odoo
    console.log('Authenticating with Odoo...');
    const uid = await authenticateOdoo(config);
    console.log(`Authenticated with Odoo, UID: ${uid}`);

    // Export each product
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
      const productName = analysis.analysis_result?.product_name || analysis.product_url;
      console.log(`Exporting product: ${productName}`);
      
      const productData = await mapAnalysisToOdooProduct(analysis, categories || [], fieldMappings || []);
      const result = await createOdooProduct(config, uid, productData);
      
      if (result.success && result.product_id) {
        successCount++;
        console.log(`✓ Product created with ID: ${result.product_id}`);
        
        // Upload additional images if available
        if (analysis.image_urls && analysis.image_urls.length > 1) {
          const additionalImages = analysis.image_urls.slice(1);
          console.log(`Uploading ${additionalImages.length} additional images...`);
          const imageResult = await createProductImages(config, uid, result.product_id, additionalImages);
          console.log(`✓ Images: ${imageResult.success} uploaded, ${imageResult.failed} failed`);
        }
      } else {
        errorCount++;
        console.log(`✗ Failed to create product: ${result.error}`);
      }

      results.push({
        analysis_id: analysis.id,
        product_name: productData.name,
        ...result,
      });
    }

    // Log export
    await supabase.from('export_logs').insert({
      user_id: user.id,
      products_count: analyses.length,
      success_count: successCount,
      error_count: errorCount,
      export_details: { results },
    });

    console.log(`Export complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: analyses.length,
        success_count: successCount,
        error_count: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
