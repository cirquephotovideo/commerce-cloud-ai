import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { handleError } from '../_shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, productData, purchasePrice, preferred_model } = await req.json();
    console.log('[ENRICH-COST] Starting cost analysis for:', analysisId);
    console.log('[ENRICH-COST] Preferred model:', preferred_model || 'auto');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch current analysis
    const { data: currentAnalysis, error: fetchError } = await supabase
      .from('product_analyses')
      .select('analysis_result, enrichment_status')
      .eq('id', analysisId)
      .single();

    if (fetchError) throw fetchError;

    // Mark as processing
    const enrichmentStatus = currentAnalysis.enrichment_status || {};
    enrichmentStatus.cost_analysis = 'processing';
    
    await supabase
      .from('product_analyses')
      .update({ enrichment_status: enrichmentStatus })
      .eq('id', analysisId);

    console.log('[ENRICH-COST] Status set to processing');

    const prompt = `Analyse les coûts pour ce produit :

Nom: ${productData?.name || 'Produit'}
Prix d'achat: ${purchasePrice || 'Non spécifié'}
Description: ${productData?.description || ''}

Fournis une analyse détaillée des coûts en JSON:
{
  "manufacturing_cost_estimate": "",
  "shipping_cost_estimate": "",
  "customs_duties": "",
  "recommended_margin": "",
  "recommended_selling_price": "",
  "cost_breakdown": {
    "materials": "",
    "labor": "",
    "overhead": ""
  },
  "profitability_analysis": "",
  "pricing_strategy": ""
}`;

    // ✅ Use callAIWithFallback with web_search for Ollama
    const aiResponse = await callAIWithFallback({
      model: preferred_model || 'gpt-oss:120b-cloud',
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse de coûts et pricing.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      web_search: true  // Enable Ollama native web search
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'AI call failed');
    }

    console.log(`[ENRICH-COST] ✅ Provider used: ${aiResponse.provider}`);
    const costAnalysisRaw = aiResponse.content;
    
    console.log('[ENRICH-COST] AI response length:', costAnalysisRaw?.length || 0);

    // Try to parse JSON, fallback to raw string
    let costAnalysis;
    let parseError = null;
    try {
      costAnalysis = JSON.parse(costAnalysisRaw);
    } catch (e) {
      console.warn('[ENRICH-COST] Failed to parse JSON, storing as string');
      costAnalysis = costAnalysisRaw;
      parseError = e instanceof Error ? e.message : 'JSON parse error';
    }

    // Merge with existing analysis_result (garantir que l'objet existe)
    const currentResult = currentAnalysis.analysis_result || {};
    const newAnalysisResult = {
      ...currentResult,
      cost_analysis: costAnalysis,
      _enrichment_provider: aiResponse.provider,
      _last_enriched: new Date().toISOString(),
      ...(parseError && { cost_analysis_parse_error: parseError })
    };

    // Update status to completed
    enrichmentStatus.cost_analysis = 'completed';

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        cost_analysis: costAnalysis,  // ✅ Sauvegarde dans la colonne dédiée
        analysis_result: newAnalysisResult,  // ✅ + dans analysis_result pour compatibilité
        enrichment_status: enrichmentStatus
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-COST] Cost analysis saved → completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        costAnalysis,
        provider: aiResponse.provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-COST] Error:', error);
    console.error('[ENRICH-COST] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // ✅ Mark as failed but return 200
    try {
      const { analysisId } = await req.json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      const { data: currentAnalysis } = await supabase
        .from('product_analyses')
        .select('analysis_result, enrichment_status')
        .eq('id', analysisId)
        .single();

      if (currentAnalysis) {
        const enrichmentStatus = currentAnalysis.enrichment_status || {};
        enrichmentStatus.cost_analysis = 'failed';
        
        await supabase
          .from('product_analyses')
          .update({
            analysis_result: {
              ...currentAnalysis.analysis_result,
              cost_analysis_error: error instanceof Error ? error.message : 'Unknown error'
            },
            enrichment_status: enrichmentStatus
          })
          .eq('id', analysisId);
      }
    } catch (e) {
      console.error('[ENRICH-COST] Failed to mark as failed:', e);
    }
    
    return handleError(error, 'ENRICH-COST', corsHeaders);
  }
});
