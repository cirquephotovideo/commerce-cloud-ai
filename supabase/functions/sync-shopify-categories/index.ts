import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('[SYNC-SHOPIFY] Starting category sync for user:', user.id);

    // Get Shopify configuration
    const { data: config, error: configError } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'shopify')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Shopify configuration not found');
    }

    const shopifyUrl = config.platform_url.replace(/\/$/, '');
    const accessToken = config.access_token_encrypted;

    // Fetch product types (Shopify's way of categorizing)
    const response = await fetch(`${shopifyUrl}/admin/api/2024-01/products.json?fields=product_type&limit=250`, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${error}`);
    }

    const data = await response.json();
    
    // Extract unique product types
    const productTypes = new Set<string>();
    data.products.forEach((product: any) => {
      if (product.product_type) {
        productTypes.add(product.product_type);
      }
    });

    console.log('[SYNC-SHOPIFY] Found product types:', Array.from(productTypes));

    // Delete existing categories
    await supabase
      .from('platform_categories')
      .delete()
      .eq('user_id', user.id)
      .eq('platform_type', 'shopify');

    // Insert new categories
    const categoriesToInsert = Array.from(productTypes).map(type => ({
      user_id: user.id,
      platform_type: 'shopify',
      platform_category_id: type.toLowerCase().replace(/\s+/g, '_'),
      category_name: type,
      full_path: type,
      last_synced_at: new Date().toISOString()
    }));

    if (categoriesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('platform_categories')
        .insert(categoriesToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    console.log('[SYNC-SHOPIFY] Synced categories:', categoriesToInsert.length);

    return new Response(
      JSON.stringify({
        success: true,
        categories_synced: categoriesToInsert.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC-SHOPIFY] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
