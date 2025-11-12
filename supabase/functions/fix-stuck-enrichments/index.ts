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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Recherche des produits bloqués et en erreur...');

    // 1. Trouver TOUS les produits en statut "enriching" (orphelins potentiels)
    const { data: allEnrichingProducts, error: enrichingError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name, last_updated')
      .eq('enrichment_status', 'enriching')
      .order('last_updated', { ascending: true })
      .limit(10000);

    if (enrichingError) throw enrichingError;

    console.log(`📦 ${allEnrichingProducts?.length || 0} produits en statut enriching trouvés`);

    // Vérifier lesquels n'ont PAS de tâche dans la queue (orphelins)
    let orphanProducts = [];
    if (allEnrichingProducts && allEnrichingProducts.length > 0) {
      const productIds = allEnrichingProducts.map(p => p.id);
      const { data: existingTasks } = await supabaseClient
        .from('enrichment_queue')
        .select('supplier_product_id')
        .in('supplier_product_id', productIds)
        .in('status', ['pending', 'processing']);

      const existingIds = new Set(existingTasks?.map(t => t.supplier_product_id) || []);
      orphanProducts = allEnrichingProducts.filter(p => !existingIds.has(p.id));
      
      console.log(`🔍 Trouvé ${orphanProducts.length} produits orphelins sans tâche`);
    }

    // 2. Trouver les produits vraiment bloqués (>10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckProducts, error: stuckError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name, last_updated')
      .eq('enrichment_status', 'enriching')
      .lt('last_updated', tenMinutesAgo)
      .order('last_updated', { ascending: true })
      .limit(1000);

    if (stuckError) throw stuckError;

    // 3. Trouver tous les produits en statut "failed"
    const { data: failedProducts, error: failedError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name')
      .eq('enrichment_status', 'failed')
      .limit(1000);

    if (failedError) throw failedError;

    console.log(`⏰ ${stuckProducts?.length || 0} produits vraiment bloqués (>10 min)`);
    console.log(`❌ ${failedProducts?.length || 0} produits en erreur trouvés`);

    // 📊 Diagnostic détaillé
    console.log(`📊 Diagnostic des produits bloqués:`, {
      total_enriching: allEnrichingProducts?.length || 0,
      orphans: orphanProducts.length,
      stuck: stuckProducts?.length || 0,
      failed: failedProducts?.length || 0,
      oldest_stuck: allEnrichingProducts?.[0]?.last_updated,
      sample_products: allEnrichingProducts?.slice(0, 5).map(p => ({
        id: p.id,
        name: p.product_name,
        last_updated: p.last_updated
      }))
    });

    // Combiner tous les produits à corriger (priorité aux orphelins)
    const allProductsToFix = [
      ...orphanProducts,
      ...(stuckProducts || []).filter(s => !orphanProducts.some(o => o.id === s.id)),
      ...(failedProducts || []).filter(f => !orphanProducts.some(o => o.id === f.id) && !(stuckProducts || []).some(s => s.id === f.id)),
    ];

    if (allProductsToFix.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          fixed: 0, 
          tasks_created: 0,
          message: 'Aucun produit à corriger détecté' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. 🚀 Traitement par batch (500 produits à la fois)
    console.log(`🔧 Total produits à corriger: ${allProductsToFix.length}`);
    
    let fixedCount = 0;
    let createdTasks = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < allProductsToFix.length; i += BATCH_SIZE) {
      const batch = allProductsToFix.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allProductsToFix.length / BATCH_SIZE);
      
      console.log(`📦 Traitement batch ${batchNum}/${totalBatches}: ${batch.length} produits`);
      
      // 1. Créer toutes les tâches en une seule requête (avec gestion des conflits)
      const tasksToCreate = batch.map(product => ({
        user_id: product.user_id,
        supplier_product_id: product.id,
        enrichment_type: ['ai_analysis', 'amazon_data', 'specifications'],
        priority: 'high',
        status: 'pending',
      }));
      
      const { data: createdTasksData, error: taskError } = await supabaseClient
        .from('enrichment_queue')
        .upsert(tasksToCreate, { 
          onConflict: 'supplier_product_id',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (taskError) {
        console.error(`❌ Erreur création tâches batch ${batchNum}:`, taskError);
      } else {
        const tasksCreatedInBatch = createdTasksData?.length || 0;
        createdTasks += tasksCreatedInBatch;
        console.log(`✅ ${tasksCreatedInBatch} tâches créées pour batch ${batchNum}`);
      }
      
      // 2. Réinitialiser tous les statuts en une seule requête
      const { error: updateError } = await supabaseClient
        .from('supplier_products')
        .update({ 
          enrichment_status: 'pending',
          enrichment_error_message: null,
          last_updated: new Date().toISOString()
        })
        .in('id', batch.map(p => p.id));
      
      if (updateError) {
        console.error(`❌ Erreur mise à jour batch ${batchNum}:`, updateError);
      } else {
        fixedCount += batch.length;
        console.log(`✅ ${batch.length} produits réinitialisés (batch ${batchNum})`);
      }
    }

    console.log(`✅ Traitement par batch terminé: ${fixedCount} produits corrigés, ${createdTasks} tâches créées`);

    // 4. Déclencher le traitement de la queue
    if (createdTasks > 0) {
      console.log('🚀 Déclenchement du traitement de la queue...');
      const { error: processError } = await supabaseClient.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: 50, parallel: true } }
      );

      if (processError) {
        console.error('⚠️ Erreur déclenchement queue:', processError);
      } else {
        console.log('✅ Queue de traitement déclenchée');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fixed: fixedCount,
        tasks_created: createdTasks,
        total_processed: allProductsToFix.length,
        message: `${fixedCount} produits débloqués/réinitialisés et ${createdTasks} tâches créées`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erreur fix-stuck-enrichments:', error);
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
