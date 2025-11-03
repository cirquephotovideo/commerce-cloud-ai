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

    console.log('🔄 [AUTO-FIX] Starting automatic enrichment queue recovery...');

    // 1. Détecter les produits "enriching" sans tâche correspondante
    const { data: enrichingProducts, error: enrichingError } = await supabaseClient
      .from('supplier_products')
      .select('id, user_id, product_name')
      .eq('enrichment_status', 'enriching')
      .limit(5000);

    if (enrichingError) throw enrichingError;

    console.log(`📦 Found ${enrichingProducts?.length || 0} products in "enriching" status`);

    if (!enrichingProducts || enrichingProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          orphans_found: 0,
          message: 'No products in enriching status' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Vérifier lesquels n'ont PAS de tâche dans enrichment_queue
    const productIds = enrichingProducts.map(p => p.id);
    const { data: existingTasks, error: taskError } = await supabaseClient
      .from('enrichment_queue')
      .select('supplier_product_id')
      .in('supplier_product_id', productIds)
      .in('status', ['pending', 'processing']);

    if (taskError) throw taskError;

    const existingIds = new Set(existingTasks?.map(t => t.supplier_product_id) || []);
    const orphanProducts = enrichingProducts.filter(p => !existingIds.has(p.id));

    console.log(`🔍 Found ${orphanProducts.length} orphan products without tasks`);

    if (orphanProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          orphans_found: 0,
          message: 'All enriching products have corresponding tasks' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tasksCreated = 0;
    let productsReset = 0;

    // 3. Traiter par lots de 100 pour éviter les timeouts
    const BATCH_SIZE = 100;
    for (let i = 0; i < orphanProducts.length; i += BATCH_SIZE) {
      const batch = orphanProducts.slice(i, i + BATCH_SIZE);
      
      // Créer les tâches manquantes
      const tasksToCreate = batch.map(product => ({
        user_id: product.user_id,
        supplier_product_id: product.id,
        enrichment_type: ['ai_analysis', 'amazon_data', 'specifications'],
        priority: 'high',
        status: 'pending',
      }));

      const { error: insertError } = await supabaseClient
        .from('enrichment_queue')
        .insert(tasksToCreate);

      if (insertError) {
        console.error(`❌ Error creating tasks for batch ${i}:`, insertError);
        continue;
      }

      tasksCreated += tasksToCreate.length;

      // Réinitialiser les produits en "pending"
      const productIdsToReset = batch.map(p => p.id);
      const { error: updateError } = await supabaseClient
        .from('supplier_products')
        .update({ 
          enrichment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .in('id', productIdsToReset);

      if (updateError) {
        console.error(`❌ Error resetting products for batch ${i}:`, updateError);
      } else {
        productsReset += batch.length;
      }

      console.log(`✅ Batch ${i / BATCH_SIZE + 1}: ${batch.length} tasks created, ${batch.length} products reset`);
    }

    // 4. Gérer aussi les produits bloqués depuis >10 min (stuck products)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckProducts, error: stuckError } = await supabaseClient
      .from('supplier_products')
      .select('id, user_id')
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', tenMinutesAgo)
      .limit(1000);

    if (stuckError) {
      console.error('❌ Error fetching stuck products:', stuckError);
    } else if (stuckProducts && stuckProducts.length > 0) {
      console.log(`⏰ Found ${stuckProducts.length} stuck products (>10 min)`);
      
      // Vérifier lesquels n'ont pas de tâche
      const stuckIds = stuckProducts.map(p => p.id);
      const { data: stuckTasks } = await supabaseClient
        .from('enrichment_queue')
        .select('supplier_product_id')
        .in('supplier_product_id', stuckIds)
        .in('status', ['pending', 'processing']);

      const stuckExistingIds = new Set(stuckTasks?.map(t => t.supplier_product_id) || []);
      const stuckOrphans = stuckProducts.filter(p => !stuckExistingIds.has(p.id));

      if (stuckOrphans.length > 0) {
        const stuckTasksToCreate = stuckOrphans.map(product => ({
          user_id: product.user_id,
          supplier_product_id: product.id,
          enrichment_type: ['ai_analysis', 'amazon_data', 'specifications'],
          priority: 'urgent',
          status: 'pending',
        }));

        await supabaseClient.from('enrichment_queue').insert(stuckTasksToCreate);
        tasksCreated += stuckTasksToCreate.length;

        await supabaseClient
          .from('supplier_products')
          .update({ enrichment_status: 'pending', updated_at: new Date().toISOString() })
          .in('id', stuckOrphans.map(p => p.id));

        productsReset += stuckOrphans.length;

        console.log(`✅ Fixed ${stuckOrphans.length} additional stuck products`);
      }
    }

    // 5. Créer une alerte si le problème est critique (>1000 orphelins)
    if (orphanProducts.length > 1000) {
      await supabaseClient.from('user_alerts').insert({
        user_id: orphanProducts[0].user_id,
        alert_type: 'system_critical',
        severity: 'high',
        title: `🚨 ${orphanProducts.length} produits orphelins détectés`,
        message: `Le système a automatiquement corrigé ${productsReset} produits et créé ${tasksCreated} tâches. Vérifiez la progression.`,
        action_url: '/suppliers'
      });
    }

    // 6. Relancer le processeur si des tâches ont été créées
    if (tasksCreated > 0) {
      console.log('🚀 Triggering enrichment queue processing...');
      const { error: processError } = await supabaseClient.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: 100, parallel: true } }
      );

      if (processError) {
        console.error('⚠️ Error triggering queue:', processError);
      } else {
        console.log('✅ Queue processing triggered');
      }
    }

    console.log(`✅ [AUTO-FIX] Recovery complete: ${orphanProducts.length} orphans found, ${tasksCreated} tasks created, ${productsReset} products reset`);

    return new Response(
      JSON.stringify({
        success: true,
        orphans_found: orphanProducts.length,
        tasks_created: tasksCreated,
        products_reset: productsReset,
        message: `Auto-fix completed: ${orphanProducts.length} orphans detected, ${tasksCreated} tasks created`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ [AUTO-FIX] Error:', error);
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
