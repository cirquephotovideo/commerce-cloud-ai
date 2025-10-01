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

// Map analysis result to Odoo product data with full Odoo 19 fields
async function mapAnalysisToOdooProduct(analysis: ProductAnalysis, categories: any[]): Promise<any> {
  const result = analysis.analysis_result;
  
  // Extract price from pricing analysis
  let price = 0;
  if (result.pricing?.estimated_price) {
    const priceStr = result.pricing.estimated_price.replace(/[^0-9.,]/g, '');
    price = parseFloat(priceStr.replace(',', '.')) || 0;
  }

  // Get barcode if available
  const barcode = analysis.product_url.match(/^\d{8,13}$/) ? analysis.product_url : '';

  // Find category ID if mapped
  let categId = null;
  if (analysis.mapped_category_id) {
    const category = categories.find(c => c.odoo_category_id === parseInt(analysis.mapped_category_id!));
    if (category) {
      categId = category.odoo_category_id;
    }
  }

  // Get primary category from analysis if no mapped category
  if (!categId && result.tags_categories?.primary_category) {
    const categoryMatch = categories.find(c => 
      c.category_name.toLowerCase().includes(result.tags_categories.primary_category.toLowerCase()) ||
      c.full_path.toLowerCase().includes(result.tags_categories.primary_category.toLowerCase())
    );
    if (categoryMatch) {
      categId = categoryMatch.odoo_category_id;
    }
  }

  // Download and convert first image to base64 if available
  let imageBase64 = null;
  if (analysis.image_urls && analysis.image_urls.length > 0) {
    console.log(`Downloading image from: ${analysis.image_urls[0]}`);
    imageBase64 = await downloadImageAsBase64(analysis.image_urls[0]);
  }

  // Build complete product data with Odoo 19 mapping
  const productData: any = {
    name: result.product_name || analysis.product_url,
    description: result.description?.suggested_description || result.description?.optimized_description || '',
    description_sale: result.description?.suggested_description?.substring(0, 500) || '',
    list_price: price,
    standard_price: price * 0.7, // Estimate cost at 70% of selling price
    default_code: barcode || `REF-${Date.now()}`,
    barcode: barcode,
    website_meta_title: result.seo?.title || result.product_name || '',
    website_meta_description: result.seo?.meta_description || '',
    website_meta_keywords: result.seo?.keywords?.join(', ') || '',
    categ_id: categId,
  };

  // Add image if downloaded successfully
  if (imageBase64) {
    productData.image_1920 = imageBase64;
  }

  // Add weight and volume if available from attributes
  if (analysis.odoo_attributes?.weight) {
    productData.weight = parseFloat(analysis.odoo_attributes.weight);
  }
  if (analysis.odoo_attributes?.volume) {
    productData.volume = parseFloat(analysis.odoo_attributes.volume);
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
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

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
      console.log(`Exporting product: ${analysis.product_url}`);
      const productData = await mapAnalysisToOdooProduct(analysis, categories || []);
      const result = await createOdooProduct(config, uid, productData);
      
      if (result.success) {
        successCount++;
        console.log(`✓ Product created with ID: ${result.product_id}`);
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
