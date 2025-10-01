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

// Create product in Odoo
async function createOdooProduct(
  config: OdooConfig,
  uid: number,
  productData: any
): Promise<{ success: boolean; error?: string; product_id?: number }> {
  try {
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
      <value><struct>
        <member><name>name</name><value><string>${productData.name || ''}</string></value></member>
        <member><name>description</name><value><string>${productData.description || ''}</string></value></member>
        <member><name>list_price</name><value><double>${productData.list_price || 0}</double></value></member>
        <member><name>default_code</name><value><string>${productData.default_code || ''}</string></value></member>
        <member><name>sale_ok</name><value><boolean>1</boolean></value></member>
        <member><name>purchase_ok</name><value><boolean>0</boolean></value></member>
        <member><name>type</name><value><string>consu</string></value></member>
        ${productData.website_meta_title ? `<member><name>website_meta_title</name><value><string>${productData.website_meta_title}</string></value></member>` : ''}
        ${productData.website_meta_description ? `<member><name>website_meta_description</name><value><string>${productData.website_meta_description}</string></value></member>` : ''}
        ${productData.website_meta_keywords ? `<member><name>website_meta_keywords</name><value><string>${productData.website_meta_keywords}</string></value></member>` : ''}
      </struct></value>
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

// Map analysis result to Odoo product data
function mapAnalysisToOdooProduct(analysis: ProductAnalysis): any {
  const result = analysis.analysis_result;
  
  // Extract price from pricing analysis
  let price = 0;
  if (result.pricing?.estimated_price) {
    const priceStr = result.pricing.estimated_price.replace(/[^0-9.,]/g, '');
    price = parseFloat(priceStr.replace(',', '.')) || 0;
  }

  // Get barcode if available
  const barcode = analysis.product_url.match(/^\d+$/) ? analysis.product_url : '';

  return {
    name: result.product_name || analysis.product_url,
    description: result.description?.suggested_description || result.description?.optimized_description || '',
    list_price: price,
    default_code: barcode,
    website_meta_title: result.seo?.title || result.product_name || '',
    website_meta_description: result.seo?.meta_description || '',
    website_meta_keywords: result.seo?.keywords?.join(', ') || '',
  };
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
      const productData = mapAnalysisToOdooProduct(analysis);
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
