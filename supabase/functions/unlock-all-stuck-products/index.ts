import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Starting complete unlock of all stuck products...');

    let totalFixed = 0;
    let totalTasksCreated = 0;
    let passes = 0;
    const MAX_PASSES = 5;
    let remainingStuck = true;

    // Loop until all products are unlocked or max passes reached
    while (remainingStuck && passes < MAX_PASSES) {
      passes++;
      console.log(`\n🔄 Pass ${passes}/${MAX_PASSES} starting...`);

      // Call fix-stuck-enrichments
      const { data: fixData, error: fixError } = await supabaseClient.functions.invoke(
        'fix-stuck-enrichments'
      );

      if (fixError) {
        console.error(`❌ Error in pass ${passes}:`, fixError);
        throw fixError;
      }

      const fixedInPass = fixData?.fixed || 0;
      const tasksCreatedInPass = fixData?.tasks_created || 0;
      
      totalFixed += fixedInPass;
      totalTasksCreated += tasksCreatedInPass;

      console.log(`✅ Pass ${passes} complete: ${fixedInPass} products fixed, ${tasksCreatedInPass} tasks created`);

      // Check if there are still stuck products
      const { count: stuckCount, error: countError } = await supabaseClient
        .from('supplier_products')
        .select('*', { count: 'exact', head: true })
        .eq('enrichment_status', 'enriching');

      if (countError) {
        console.error('❌ Error checking stuck count:', countError);
        throw countError;
      }

      remainingStuck = (stuckCount || 0) > 0;

      if (remainingStuck) {
        console.log(`⏳ ${stuckCount} products still stuck, continuing...`);
        // Pause 2 seconds between passes to avoid overload
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('✅ All products unlocked!');
      }
    }

    // Final status check
    const { count: finalStuckCount } = await supabaseClient
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriching');

    // Trigger processing if tasks were created
    if (totalTasksCreated > 0) {
      console.log('🚀 Triggering enrichment queue processing...');
      const { error: processError } = await supabaseClient.functions.invoke(
        'process-enrichment-queue'
      );

      if (processError) {
        console.warn('⚠️ Warning: Could not trigger queue processing:', processError);
      } else {
        console.log('✅ Queue processing triggered successfully');
      }
    }

    const result = {
      success: true,
      passes,
      total_fixed: totalFixed,
      tasks_created: totalTasksCreated,
      remaining_stuck: finalStuckCount || 0,
      completed: (finalStuckCount || 0) === 0,
      message: (finalStuckCount || 0) === 0 
        ? `✅ Tous les produits débloqués en ${passes} passes` 
        : `⚠️ ${finalStuckCount} produits restent bloqués après ${passes} passes`,
    };

    console.log('📊 Final result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Unlock all error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
