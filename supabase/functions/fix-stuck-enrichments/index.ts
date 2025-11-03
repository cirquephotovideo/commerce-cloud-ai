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

    console.log('🔍 Recherche des produits bloqués...');

    // 1. Trouver tous les produits en statut "enriching" depuis plus de 10 minutes
    const { data: stuckProducts, error: stuckError } = await supabaseClient
      .from('supplier_products')
      .select('id, supplier_id, user_id, ean, product_name')
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (stuckError) throw stuckError;

    console.log(`📦 ${stuckProducts?.length || 0} produits bloqués trouvés`);

    if (!stuckProducts || stuckProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          fixed: 0, 
          message: 'Aucun produit bloqué détecté' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Pour chaque produit bloqué, vérifier s'il a une tâche dans la queue
    let fixedCount = 0;
    let createdTasks = 0;

    for (const product of stuckProducts) {
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

      // Réinitialiser le statut du produit
      const { error: updateError } = await supabaseClient
        .from('supplier_products')
        .update({ 
          enrichment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (!updateError) {
        fixedCount++;
      } else {
        console.error(`❌ Erreur mise à jour produit ${product.id}:`, updateError);
      }
    }

    console.log(`✅ ${fixedCount} produits débloqués, ${createdTasks} tâches créées`);

    // 3. Déclencher le traitement de la queue
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
        total_stuck: stuckProducts.length,
        message: `${fixedCount} produits débloqués et ${createdTasks} tâches créées`,
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
