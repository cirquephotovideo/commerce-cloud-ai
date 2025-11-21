import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAnalysesRequest {
  userId: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, limit = 1000 }: CreateAnalysesRequest = await req.json();

    console.log(`[BULK-CREATE-ANALYSES] Creating analyses for user: ${userId}`);

    // Fetch supplier products without existing analyses
    const { data: supplierProducts, error: fetchError } = await supabase
      .from('supplier_products')
      .select('id, product_name, ean, purchase_price, supplier_id, additional_data')
      .eq('user_id', userId)
      .not('ean', 'is', null)
      .neq('ean', '')
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!supplierProducts || supplierProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No supplier products found to create analyses',
          created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BULK-CREATE-ANALYSES] Found ${supplierProducts.length} supplier products`);

    // Create product_analyses entries
    const analysesToCreate = supplierProducts.map(sp => ({
      user_id: userId,
      supplier_product_id: sp.id,
      ean: sp.ean,
      analysis_result: {
        name: sp.product_name,
        brand: (sp.additional_data as any)?.brand || null,
      },
      cost_analysis: {
        purchase_price: sp.purchase_price
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert in batches of 500 to avoid timeouts
    const batchSize = 500;
    let totalCreated = 0;
    
    for (let i = 0; i < analysesToCreate.length; i += batchSize) {
      const batch = analysesToCreate.slice(i, i + batchSize);
      
      const { data, error: insertError } = await supabase
        .from('product_analyses')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`[BULK-CREATE-ANALYSES] Error inserting batch ${i / batchSize}:`, insertError);
        throw insertError;
      }

      totalCreated += data?.length || 0;
      console.log(`[BULK-CREATE-ANALYSES] Batch ${i / batchSize + 1} created: ${data?.length || 0} analyses`);
    }

    console.log(`[BULK-CREATE-ANALYSES] Successfully created ${totalCreated} analyses`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: totalCreated,
        message: `${totalCreated} analyses créées avec succès`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[BULK-CREATE-ANALYSES] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
