import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SYNC-ENRICHMENTS] Starting migration of enriched data to analysis_result');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer tous les product_analyses avec des colonnes enrichies mais analysis_result vide
    const { data: analyses, error: fetchError } = await supabase
      .from('product_analyses')
      .select('id, specifications, cost_analysis, long_description, analysis_result')
      .or('specifications.not.is.null,cost_analysis.not.is.null,long_description.not.is.null');

    if (fetchError) throw fetchError;

    console.log(`[SYNC-ENRICHMENTS] Found ${analyses?.length || 0} analyses to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Mettre à jour chaque analyse
    for (const analysis of analyses || []) {
      const currentResult = analysis.analysis_result || {};
      
      // Vérifier si les données sont déjà dans analysis_result
      const hasSpecsInResult = currentResult.specifications;
      const hasCostInResult = currentResult.cost_analysis;
      const hasTechDescInResult = currentResult.technical_description;

      // Si les données sont déjà là, passer
      if (hasSpecsInResult && hasCostInResult && hasTechDescInResult) {
        skippedCount++;
        continue;
      }

      // Construire le nouvel analysis_result fusionné
      const newAnalysisResult = {
        ...currentResult,
        ...(analysis.specifications && !hasSpecsInResult && { specifications: analysis.specifications }),
        ...(analysis.cost_analysis && !hasCostInResult && { cost_analysis: analysis.cost_analysis }),
        ...(analysis.long_description && !hasTechDescInResult && { technical_description: analysis.long_description }),
        _synced_at: new Date().toISOString()
      };

      // Mettre à jour la base
      const { error: updateError } = await supabase
        .from('product_analyses')
        .update({ analysis_result: newAnalysisResult })
        .eq('id', analysis.id);

      if (updateError) {
        console.error(`[SYNC-ENRICHMENTS] ❌ Failed to update ${analysis.id}:`, updateError);
      } else {
        updatedCount++;
        console.log(`[SYNC-ENRICHMENTS] ✅ Updated ${analysis.id}`);
      }
    }

    console.log(`[SYNC-ENRICHMENTS] Migration complete: ${updatedCount} updated, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true,
        updated: updatedCount,
        skipped: skippedCount,
        total: analyses?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC-ENRICHMENTS] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});