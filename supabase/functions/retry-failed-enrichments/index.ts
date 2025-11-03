import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

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

    console.log('🔄 Starting retry of failed enrichments...');

    // 1. Find all failed products
    const { data: failedProducts, error: failedError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name, enrichment_error_message')
      .eq('enrichment_status', 'failed')
      .limit(100);

    if (failedError) throw failedError;

    console.log(`📦 ${failedProducts?.length || 0} failed products found`);

    if (!failedProducts || failedProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          retried: 0, 
          message: 'No failed products to retry' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let retriedCount = 0;
    let tasksCreated = 0;

    for (const product of failedProducts) {
      // Reset product status to pending
      const { error: updateError } = await supabaseClient
        .from('supplier_products')
        .update({ 
          enrichment_status: 'pending',
          enrichment_error_message: null,
          last_updated: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`❌ Error updating product ${product.id}:`, updateError);
        continue;
      }

      // Check if enrichment task already exists
      const { data: existingTask } = await supabaseClient
        .from('enrichment_queue')
        .select('id')
        .eq('supplier_product_id', product.id)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (!existingTask) {
        // Create new enrichment task
        const { error: insertError } = await supabaseClient
          .from('enrichment_queue')
          .insert({
            user_id: product.user_id,
            supplier_product_id: product.id,
            enrichment_type: ['ai_analysis', 'amazon_data', 'specifications'],
            priority: 'normal',
            status: 'pending',
          });

        if (!insertError) {
          tasksCreated++;
          console.log(`✅ Task created for product ${product.id}`);
        } else {
          console.error(`❌ Error creating task for ${product.id}:`, insertError);
        }
      }

      retriedCount++;
    }

    console.log(`✅ ${retriedCount} products reset to pending, ${tasksCreated} tasks created`);

    // Trigger enrichment queue processing
    if (tasksCreated > 0) {
      console.log('🚀 Triggering enrichment queue processing...');
      const { error: processError } = await supabaseClient.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: 50, parallel: true } }
      );

      if (processError) {
        console.error('⚠️ Error triggering queue:', processError);
      } else {
        console.log('✅ Queue processing triggered');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        retried: retriedCount,
        tasks_created: tasksCreated,
        message: `${retriedCount} products reset to retry, ${tasksCreated} tasks created`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error retry-failed-enrichments:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
