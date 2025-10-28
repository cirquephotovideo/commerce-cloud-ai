import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyConfig {
  platform_url: string;
  access_token_encrypted: string;
}

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  image_urls: any[];
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
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysisIds } = await req.json();

  console.log('[EXPORT-SHOPIFY] Starting Shopify export for user:', user.id);
  console.log('[EXPORT-SHOPIFY] Analysis IDs to export:', analysisIds);

    // Get Shopify configuration
    const { data: config, error: configError } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'shopify')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Shopify configuration not found. Please configure Shopify in settings.');
    }

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from('platform_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'shopify')
      .eq('is_active', true);

    // Get categories
    const { data: categories } = await supabase
      .from('platform_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'shopify');

    // Get analyses
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('*')
      .in('id', analysisIds)
      .eq('user_id', user.id);

    if (analysesError || !analyses || analyses.length === 0) {
      throw new Error('No analyses found');
    }

    const shopifyUrl = config.platform_url.replace(/\/$/, '');
    const accessToken = config.access_token_encrypted; // In production, decrypt this

    const results = {
      success_count: 0,
      error_count: 0,
      details: [] as any[]
    };

    // Export each product to Shopify
    for (const analysis of analyses) {
      try {
        const productData = mapAnalysisToShopify(analysis, fieldMappings || [], categories || []);
        
        console.log('[EXPORT-SHOPIFY] Creating product:', productData.product.title);

        const response = await fetch(`${shopifyUrl}/admin/api/2024-01/products.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
          },
          body: JSON.stringify({ product: productData.product })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Shopify API error: ${error}`);
        }

        const result = await response.json();
        
        results.success_count++;
        results.details.push({
          analysis_id: analysis.id,
          product_url: analysis.product_url,
          status: 'success',
          shopify_product_id: result.product.id
        });

        console.log('[EXPORT-SHOPIFY] Product created successfully:', result.product.id);
      } catch (error) {
        console.error('[EXPORT-SHOPIFY] Error creating product:', error);
        results.error_count++;
        results.details.push({
          analysis_id: analysis.id,
          product_url: analysis.product_url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log export
    await supabase.from('platform_export_logs').insert({
      user_id: user.id,
      platform_type: 'shopify',
      products_count: analyses.length,
      success_count: results.success_count,
      error_count: results.error_count,
      export_details: results.details
    });

    return new Response(
      JSON.stringify({
        success: true,
        success_count: results.success_count,
        error_count: results.error_count,
        details: results.details
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EXPORT-SHOPIFY] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapAnalysisToShopify(
  analysis: ProductAnalysis,
  fieldMappings: any[],
  categories: any[]
): any {
  const result = analysis.analysis_result || {};
  
  // Default mapping
  let productData: any = {
    title: result.title || result.name || 'Product',
    body_html: result.description || '',
    vendor: result.brand || result.manufacturer || '',
    product_type: result.category || '',
    tags: result.tags?.join(', ') || '',
    variants: [{
      price: result.price?.toString() || '0',
      sku: result.sku || result.ean || result.reference || '',
      barcode: result.ean || result.barcode || '',
      inventory_management: 'shopify',
      inventory_policy: 'deny'
    }]
  };

  // Apply custom field mappings
  fieldMappings.forEach(mapping => {
    const value = getNestedValue(result, mapping.source_path);
    if (value !== undefined && value !== null) {
      setNestedValue(productData, mapping.platform_field, value);
    }
  });

  // Handle images
  if (analysis.image_urls && Array.isArray(analysis.image_urls) && analysis.image_urls.length > 0) {
    productData.images = analysis.image_urls.map((url: string) => ({ src: url }));
  }

  return { product: productData };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}
