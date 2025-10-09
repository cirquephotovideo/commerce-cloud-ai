import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    const { supplierId } = await req.json();

    console.log('Starting API sync for supplier:', supplierId);

    // Load supplier configuration
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .eq('user_id', user.id)
      .single();

    if (supplierError || !supplier) {
      throw new Error('Supplier not found');
    }

    const config = supplier.connection_config as any;
    const mapping = supplier.mapping_config as any;
    
    if (!config.api_url) {
      throw new Error('Missing API configuration');
    }

    // Prepare API request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication
    if (config.auth_type === 'bearer' && config.api_key) {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    } else if (config.auth_type === 'basic' && config.username && config.password) {
      headers['Authorization'] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
    } else if (config.auth_type === 'apikey' && config.api_key) {
      headers[config.api_key_header || 'X-API-Key'] = config.api_key;
    }

    // Call supplier API
    console.log('Calling API:', config.api_url);
    const apiResponse = await fetch(config.api_url, {
      method: config.method || 'GET',
      headers,
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status}`);
    }

    const apiData = await apiResponse.json();
    console.log('API response received');

    // Extract products array from response
    let products = Array.isArray(apiData) ? apiData : apiData[config.data_path || 'products'];
    
    if (!Array.isArray(products)) {
      throw new Error('Invalid API response format');
    }

    let matched = 0;
    let newProducts = 0;
    let failed = 0;

    // Process each product
    for (const item of products) {
      try {
        // Map API fields to our format using mapping config
        const ean = mapping?.ean ? getNestedValue(item, mapping.ean) : item.ean || item.barcode;
        const reference = mapping?.reference ? getNestedValue(item, mapping.reference) : item.reference || item.sku;
        const name = mapping?.name ? getNestedValue(item, mapping.name) : item.name || item.title;
        const price = mapping?.price ? getNestedValue(item, mapping.price) : item.price || item.cost_price;
        const stock = mapping?.stock ? getNestedValue(item, mapping.stock) : item.stock || item.stock_quantity;

        if (!name || !price) {
          failed++;
          continue;
        }

        const productData = {
          user_id: user.id,
          supplier_id: supplierId,
          ean: ean || null,
          supplier_reference: reference || null,
          product_name: name,
          purchase_price: parseFloat(price),
          stock_quantity: stock ? parseInt(stock) : null,
          currency: config.currency || 'EUR',
          additional_data: item,
        };

        // Check if product exists
        const { data: existing } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('ean', ean)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('supplier_products')
            .update(productData)
            .eq('id', existing.id);
          matched++;
        } else {
          await supabase
            .from('supplier_products')
            .insert([productData]);
          newProducts++;
        }

        // Try to match with existing product_analyses
        if (ean) {
          const { data: analysis } = await supabase
            .from('product_analyses')
            .select('id')
            .ilike('analysis_results', `%${ean}%`)
            .maybeSingle();

          if (analysis) {
            await supabase
              .from('product_analyses')
              .update({
                purchase_price: parseFloat(price),
                purchase_currency: config.currency || 'EUR',
                last_price_update: new Date().toISOString(),
              })
              .eq('id', analysis.id);
          }
        }
      } catch (error) {
        console.error('Error processing product:', error);
        failed++;
      }
    }

    // Log the import
    await supabase.from('supplier_import_logs').insert([{
      user_id: user.id,
      supplier_id: supplierId,
      import_type: 'api',
      source_file: config.api_url,
      products_found: products.length,
      products_matched: matched,
      products_new: newProducts,
      products_updated: matched,
      products_failed: failed,
      import_status: failed === 0 ? 'success' : failed < products.length ? 'partial' : 'failed',
    }]);

    // Update supplier last sync
    await supabase
      .from('supplier_configurations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', supplierId);

    return new Response(
      JSON.stringify({
        success: true,
        imported: products.length - failed,
        matched,
        newProducts,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('API sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to get nested object value by path
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
