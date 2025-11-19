import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[CLEANUP-SUPPLIER] Looking for stuck supplier products...');

    // Find products stuck in "enriching" status for more than 10 minutes
    const { data: stuckProducts, error: fetchError } = await supabaseClient
      .from('supplier_products')
      .select('id, product_name, supplier_id, enrichment_status')
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (fetchError) {
      throw fetchError;
    }

    const count = stuckProducts?.length || 0;
    console.log(`[CLEANUP-SUPPLIER] Found ${count} stuck products`);

    if (count === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No stuck products found',
          cleanedCount: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset to pending status
    const { error: updateError } = await supabaseClient
      .from('supplier_products')
      .update({
        enrichment_status: 'pending',
        enrichment_progress: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (updateError) {
      throw updateError;
    }

    console.log(`[CLEANUP-SUPPLIER] Reset ${count} products to pending`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${count} products reset to pending`,
        cleanedCount: count,
        products: stuckProducts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLEANUP-SUPPLIER] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
