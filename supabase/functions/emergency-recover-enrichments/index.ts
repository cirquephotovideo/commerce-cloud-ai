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

    console.log('🚨 RÉCUPÉRATION D\'URGENCE DÉMARRÉE');

    // Step 1: Call auto_fix_orphan_products()
    console.log('Step 1: Calling auto_fix_orphan_products()...');
    const { data: autoFixResult, error: autoFixError } = await supabaseClient
      .rpc('auto_fix_orphan_products');
    
    if (autoFixError) {
      console.error('Error in auto_fix_orphan_products:', autoFixError);
      throw autoFixError;
    }

    console.log('✅ auto_fix_orphan_products result:', autoFixResult);

    // Step 2: Call fix-stuck-enrichments edge function
    console.log('Step 2: Calling fix-stuck-enrichments...');
    const { data: fixStuckResult, error: fixStuckError } = await supabaseClient.functions
      .invoke('fix-stuck-enrichments', {
        body: {}
      });
    
    if (fixStuckError) {
      console.error('Error in fix-stuck-enrichments:', fixStuckError);
    } else {
      console.log('✅ fix-stuck-enrichments result:', fixStuckResult);
    }

    // Step 3: Trigger process-enrichment-queue
    console.log('Step 3: Triggering process-enrichment-queue...');
    const { error: processError } = await supabaseClient.functions
      .invoke('process-enrichment-queue', {
        body: { batch_size: 10 }
      });
    
    if (processError) {
      console.error('Error triggering process-enrichment-queue:', processError);
    } else {
      console.log('✅ process-enrichment-queue triggered');
    }

    // Step 4: Get final status counts
    const { count: orphansFixed } = await supabaseClient
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'pending');

    const { count: queueCount } = await supabaseClient
      .from('enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);

    const result = {
      success: true,
      auto_fix_result: autoFixResult,
      fix_stuck_result: fixStuckResult,
      final_status: {
        products_pending: orphansFixed || 0,
        queue_tasks: queueCount || 0
      },
      message: `✅ Récupération d'urgence terminée. ${orphansFixed || 0} produits réinitialisés, ${queueCount || 0} tâches en file.`
    };

    console.log('🎉 RÉCUPÉRATION TERMINÉE:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Emergency recovery error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
