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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Shopify Admin API
    const response = await fetch(
      `${config.platform_url}/admin/api/2024-01/products.json?limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': config.access_token_encrypted,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const { products } = await response.json();

    let imported = 0, matched = 0, errors = 0;
    const errorDetails = [];

    for (const product of products) {
      const variant = product.variants[0];
      if (!variant) continue;

      try {
        const ean = variant.barcode && isValidEAN13(variant.barcode) ? variant.barcode : null;

        const { data: supplierProduct, error: insertError } = await supabaseClient
          .from('supplier_products')
          .upsert({
            user_id: user.id,
            supplier_id: supplier_id,
            supplier_reference: variant.sku || `shopify_${product.id}`,
            ean: ean,
            product_name: product.title,
            purchase_price: parseFloat(variant.compare_at_price || variant.price || 0),
            stock_quantity: variant.inventory_quantity || 0,
            currency: 'EUR',
            supplier_url: `${config.platform_url}/admin/products/${product.id}`,
          }, {
            onConflict: 'user_id,supplier_id,supplier_reference',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        imported++;

        if (ean) {
          const { data: analysis } = await supabaseClient
            .from('product_analyses')
            .select('id')
            .eq('user_id', user.id)
            .eq('ean', ean)
            .maybeSingle();

          if (analysis) {
            await supabaseClient
              .from('product_analyses')
              .update({
                supplier_product_id: supplierProduct.id,
                purchase_price: parseFloat(variant.compare_at_price || variant.price || 0),
                purchase_currency: 'EUR',
              })
              .eq('id', analysis.id);
            matched++;
          }
        }
      } catch (err: any) {
        errors++;
        errorDetails.push({
          product: product.title,
          error: err.message,
        });
      }
    }

    await supabaseClient.from('supplier_import_logs').insert({
      user_id: user.id,
      supplier_id: supplier_id,
      import_type: 'shopify_api',
      products_count: products.length,
      success_count: imported,
      error_count: errors,
      error_details: errorDetails.length > 0 ? errorDetails : null,
    });

    if (supplier_id) {
      await supabaseClient
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplier_id);
    }

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
    console.error('Error in import-from-shopify:', error);
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
