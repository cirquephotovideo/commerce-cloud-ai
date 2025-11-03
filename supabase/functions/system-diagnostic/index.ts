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

    console.log('🔍 Démarrage du diagnostic système...');

    // 1. Vérifier les produits bloqués (enriching depuis >10 min)
    const { count: stuckCount } = await supabaseClient
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // 2. Vérifier les produits en erreur
    const { count: failedCount } = await supabaseClient
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'failed');

    // 3. Vérifier les produits en cours d'enrichissement (tous)
    const { count: enrichingCount } = await supabaseClient
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriching');

    // 4. Vérifier la queue d'enrichissement
    const { count: queuePending } = await supabaseClient
      .from('enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: queueProcessing } = await supabaseClient
      .from('enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    // 5. Récupérer les dernières erreurs d'import
    const { data: recentErrors } = await supabaseClient
      .from('import_errors')
      .select('id, error_type, error_message, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. Récupérer des exemples de produits en erreur
    const { data: failedExamples } = await supabaseClient
      .from('supplier_products')
      .select('id, product_name, enrichment_error_message')
      .eq('enrichment_status', 'failed')
      .limit(3);

    // Analyser et construire le diagnostic
    const diagnosis = {
      issues: [] as string[],
      recommendations: [] as string[],
      severity: 'ok' as 'ok' | 'warning' | 'critical',
      stats: {
        stuckCount: stuckCount || 0,
        failedCount: failedCount || 0,
        enrichingCount: enrichingCount || 0,
        queuePending: queuePending || 0,
        queueProcessing: queueProcessing || 0,
      },
      details: {
        recentErrors: recentErrors || [],
        failedExamples: failedExamples || [],
      },
    };

    // Analyser les problèmes critiques
    if ((stuckCount || 0) > 100) {
      diagnosis.issues.push(`🚨 ${stuckCount} produits bloqués en enrichissement depuis >10 minutes`);
      diagnosis.recommendations.push('Débloquer immédiatement avec "Débloquer tout"');
      diagnosis.severity = 'critical';
    }

    if ((enrichingCount || 0) > 1000 && (queuePending || 0) === 0 && (queueProcessing || 0) === 0) {
      diagnosis.issues.push(`⚠️ ${enrichingCount} produits en "enriching" mais la queue est vide`);
      diagnosis.recommendations.push('Cliquer sur "Débloquer tout" pour créer les tâches manquantes');
      diagnosis.severity = 'critical';
    }

    if ((failedCount || 0) > 50) {
      diagnosis.issues.push(`❌ ${failedCount} produits en erreur nécessitent une action`);
      diagnosis.recommendations.push('Analyser les logs puis "Réessayer" ou "Ignorer" selon le type d\'erreur');
      if (diagnosis.severity !== 'critical') diagnosis.severity = 'warning';
    }

    if ((queuePending || 0) === 0 && (queueProcessing || 0) === 0 && ((stuckCount || 0) > 0 || (failedCount || 0) > 0)) {
      diagnosis.issues.push('📭 File d\'enrichissement vide alors qu\'il y a des produits à traiter');
      diagnosis.recommendations.push('Relancer le processeur après avoir débloqué les produits');
      diagnosis.severity = 'critical';
    }

    // Ajouter des détails sur les erreurs récentes
    if (recentErrors && recentErrors.length > 0) {
      diagnosis.issues.push(`🔴 ${recentErrors.length} erreurs d'import récentes non résolues`);
      diagnosis.recommendations.push('Vérifier les logs pour identifier les causes d\'erreur');
    }

    // Si aucun problème détecté
    if (diagnosis.issues.length === 0) {
      diagnosis.issues.push('✅ Système en bonne santé');
      diagnosis.recommendations.push('Aucune action requise pour le moment');
      diagnosis.severity = 'ok';
    }

    console.log('✅ Diagnostic terminé:', diagnosis.severity);

    return new Response(
      JSON.stringify({ diagnosis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erreur system-diagnostic:', error);
    return new Response(
      JSON.stringify({
        diagnosis: {
          issues: ['Erreur lors du diagnostic'],
          recommendations: ['Réessayer dans quelques instants'],
          severity: 'critical',
          error: error.message,
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
