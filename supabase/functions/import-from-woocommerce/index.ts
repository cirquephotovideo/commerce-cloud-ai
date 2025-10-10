import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidEAN13(ean: string): boolean {
  if (!ean || !/^\d{13}$/.test(ean)) return false;
  const digits = ean.split('').map(Number);
  const checksum = digits[12];
  const sum = digits.slice(0, 12).reduce((acc, d, i) => 
    acc + d * (i % 2 === 0 ? 1 : 3), 0
  );
  return checksum === (10 - (sum % 10)) % 10;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_id, config } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    console.log(`[WOOCOMMERCE] Starting import for supplier ${supplier_id}`);

    // WooCommerce REST API
    const consumerKey = config.api_key_encrypted;
    const consumerSecret = config.api_secret_encrypted;
    const shopUrl = config.platform_url.replace(/\/$/, '');
    
    // Basic Auth pour WooCommerce
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    
    let allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    // Pagination WooCommerce (100 produits max par page)
    while (hasMore) {
      const response = await fetch(
        `${shopUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`WooCommerce API error: ${response.status} - ${await response.text()}`);
      }

      const products = await response.json();
      
      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts = [...allProducts, ...products];
        page++;
        
        // Limite de sécurité (max 1000 produits)
        if (allProducts.length >= 1000) {
          hasMore = false;
          console.log('[WOOCOMMERCE] Reached 1000 products limit');
        }
      }
    }

    console.log(`[WOOCOMMERCE] Found ${allProducts.length} products`);

    let imported = 0, matched = 0, errors = 0;
    const errorDetails: any[] = [];

    for (const product of allProducts) {
      try {
        // WooCommerce peut avoir des variations
        const sku = product.sku || `wc_${product.id}`;
        const ean = product.meta_data?.find((m: any) => m.key === '_ean')?.value || 
                    product.meta_data?.find((m: any) => m.key === 'ean')?.value || null;
        const validEan = ean && isValidEAN13(ean) ? ean : null;
        
        const price = parseFloat(product.price || product.regular_price || 0);
        const stockQty = product.stock_quantity || 0;

        const productData = {
          user_id: user.id,
          supplier_id: supplier_id,
          supplier_reference: sku,
          ean: validEan,
          product_name: product.name,
          purchase_price: price,
          stock_quantity: stockQty,
          currency: 'EUR',
          supplier_url: `${shopUrl}/wp-admin/post.php?post=${product.id}&action=edit`,
          description: product.short_description || product.description || null,
          brand: product.brands?.[0]?.name || null,
          category: product.categories?.[0]?.name || null,
        };

        const { data: supplierProduct, error: insertError } = await supabaseClient
          .from('supplier_products')
          .upsert(productData, {
            onConflict: 'user_id,supplier_id,supplier_reference',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        imported++;

        // Try to match with existing analysis by EAN
        if (validEan) {
          const { data: analysis } = await supabaseClient
            .from('product_analyses')
            .select('id')
            .eq('user_id', user.id)
            .eq('ean', validEan)
            .maybeSingle();

          if (analysis) {
            await supabaseClient
              .from('product_analyses')
              .update({
                supplier_product_id: supplierProduct.id,
                purchase_price: price,
                purchase_currency: 'EUR',
              })
              .eq('id', analysis.id);
            
            await supabaseClient
              .from('supplier_products')
              .update({ enrichment_status: 'completed', enrichment_progress: 100 })
              .eq('id', supplierProduct.id);
            
            matched++;
          }
        }
      } catch (err: any) {
        console.error('[WOOCOMMERCE] Product error:', err);
        errors++;
        errorDetails.push({
          product: product.name || product.id,
          error: err.message,
        });
      }
    }

    // Log import
    await supabaseClient.from('supplier_import_logs').insert({
      user_id: user.id,
      supplier_id: supplier_id,
      import_type: 'woocommerce_api',
      source_file: 'woocommerce_rest_api',
      products_found: allProducts.length,
      products_matched: matched,
      products_new: imported - matched,
      products_updated: matched,
      products_failed: errors,
      import_status: errors === 0 ? 'success' : errors < allProducts.length ? 'partial' : 'failed',
    });

    // Update supplier sync time
    if (supplier_id) {
      await supabaseClient
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplier_id);
    }

    console.log(`[WOOCOMMERCE] Import complete: ${imported} imported, ${matched} matched, ${errors} errors`);

    return new Response(
      JSON.stringify({
        imported,
        matched,
        new: imported - matched,
        errors,
        errorDetails: errorDetails.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[WOOCOMMERCE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        imported: 0,
        matched: 0,
        new: 0,
        errors: 1,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
