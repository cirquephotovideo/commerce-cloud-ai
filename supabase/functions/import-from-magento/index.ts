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

    console.log(`[MAGENTO] Starting import for supplier ${supplier_id}`);

    // Magento REST API
    const accessToken = config.access_token_encrypted;
    const shopUrl = config.platform_url.replace(/\/$/, '');
    
    let allProducts: any[] = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMore = true;

    // Pagination Magento
    while (hasMore && allProducts.length < 1000) {
      const response = await fetch(
        `${shopUrl}/rest/V1/products?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Magento API error: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();
      const products = data.items || [];
      
      if (products.length === 0) {
        hasMore = false;
      } else {
        allProducts = [...allProducts, ...products];
        currentPage++;
        
        // Check if we've reached the total count
        if (allProducts.length >= data.total_count) {
          hasMore = false;
        }
      }
    }

    console.log(`[MAGENTO] Found ${allProducts.length} products`);

    let imported = 0, matched = 0, errors = 0;
    const errorDetails: any[] = [];

    for (const product of allProducts) {
      try {
        // Magento custom attributes
        const getCustomAttribute = (code: string) => {
          return product.custom_attributes?.find((attr: any) => attr.attribute_code === code)?.value;
        };

        const ean = getCustomAttribute('ean') || getCustomAttribute('gtin') || null;
        const validEan = ean && isValidEAN13(ean) ? ean : null;
        
        const price = parseFloat(product.price || 0);
        const stockItem = product.extension_attributes?.stock_item;
        const stockQty = stockItem?.qty || 0;

        const productData = {
          user_id: user.id,
          supplier_id: supplier_id,
          supplier_reference: product.sku,
          ean: validEan,
          product_name: product.name,
          purchase_price: price,
          stock_quantity: stockQty,
          currency: 'EUR',
          supplier_url: `${shopUrl}/admin/catalog/product/edit/id/${product.id}`,
          description: getCustomAttribute('description') || null,
          brand: getCustomAttribute('manufacturer') || null,
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
        console.error('[MAGENTO] Product error:', err);
        errors++;
        errorDetails.push({
          product: product.name || product.sku,
          error: err.message,
        });
      }
    }

    // Log import
    await supabaseClient.from('supplier_import_logs').insert({
      user_id: user.id,
      supplier_id: supplier_id,
      import_type: 'magento_api',
      source_file: 'magento_rest_api',
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

    console.log(`[MAGENTO] Import complete: ${imported} imported, ${matched} matched, ${errors} errors`);

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
    console.error('[MAGENTO] Error:', error);
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
