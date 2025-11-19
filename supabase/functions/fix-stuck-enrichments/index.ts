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

    console.log('🔍 Recherche des produits bloqués et en erreur...');

    // 1. Trouver TOUS les produits en statut "enriching" (orphelins potentiels)
    const { data: allEnrichingProducts, error: enrichingError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name')
      .eq('enrichment_status', 'enriching')
      .limit(20000); // Increased from 2000 to handle large batches

    if (enrichingError) throw enrichingError;

    console.log(`📦 ${allEnrichingProducts?.length || 0} produits en statut enriching trouvés`);

    // Vérifier lesquels n'ont PAS de tâche dans la queue (orphelins)
    let orphanProducts: any[] = [];
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
    const { data: stuckProducts, error: stuckError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name')
      .eq('enrichment_status', 'enriching')
      .lt('last_updated', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(5000); // Increased from 100

    if (stuckError) throw stuckError;

    // 3. Trouver tous les produits en statut "failed"
    const { data: failedProducts, error: failedError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name')
      .eq('enrichment_status', 'failed')
      .limit(5000); // Increased from 1000

    if (failedError) throw failedError;

    console.log(`⏰ ${stuckProducts?.length || 0} produits vraiment bloqués (>10 min)`);
    console.log(`❌ ${failedProducts?.length || 0} produits en erreur trouvés`);

    // Combiner tous les produits à corriger (priorité aux orphelins)
    const allProductsToFix = [
      ...orphanProducts,
      ...(stuckProducts || []).filter(s => !orphanProducts.some(o => o.id === s.id)),
      ...(failedProducts || []),
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

    // 4. Pour chaque produit, vérifier s'il a une tâche et la créer si nécessaire
    let fixedCount = 0;
    let createdTasks = 0;

    // Process in batches to avoid timeout
    const BATCH_SIZE = 100;
    for (let i = 0; i < allProductsToFix.length; i += BATCH_SIZE) {
      const batch = allProductsToFix.slice(i, i + BATCH_SIZE);
      
      for (const product of batch) {
        // Vérifier si une tâche existe déjà
        const { data: existingTask } = await supabaseClient
          .from('enrichment_queue')
          .select('id')
          .eq('supplier_product_id', product.id)
          .in('status', ['pending', 'processing'])
          .maybeSingle();

        if (!existingTask) {
          // Créer une tâche d'enrichissement
          const { error: insertError } = await supabaseClient
            .from('enrichment_queue')
            .insert({
            user_id: product.user_id,
            supplier_product_id: product.id,
            enrichment_type: ['ai_analysis', 'amazon_data', 'specifications'],
            priority: 'high',
            status: 'pending',
          });

        if (!insertError) {
          createdTasks++;
          console.log(`✅ Tâche créée pour produit ${product.id}`);
        } else {
          console.error(`❌ Erreur création tâche pour ${product.id}:`, insertError);
        }
      }

      // Réinitialiser le statut du produit et effacer le message d'erreur
      const { error: updateError } = await supabaseClient
        .from('supplier_products')
        .update({ 
          enrichment_status: 'pending',
          enrichment_error_message: null,
          last_updated: new Date().toISOString()
        })
        .eq('id', product.id);

      if (!updateError) {
        fixedCount++;
      } else {
        console.error(`❌ Erreur mise à jour produit ${product.id}:`, updateError);
      }
    }
    
    // End of batch processing
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} processed`);
  }

  console.log(`✅ ${fixedCount} produits débloqués/réinitialisés, ${createdTasks} tâches créées`);

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
