import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { handleError } from '../_shared/error-handler.ts';
import { PromptTemplates } from '../_shared/prompt-templates.ts';
import { validateEnrichment } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, productData, purchasePrice, preferred_model, web_search_enabled } = await req.json();
    console.log('[ENRICH-COST] Web search:', web_search_enabled || false);
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

    // Use the new comprehensive cost analysis prompt
    const existingMarketData = currentAnalysis.analysis_result?.pricing;
    const prompt = PromptTemplates.costAnalysis(productData, purchasePrice, existingMarketData);

    // ✅ Use callAIWithFallback with web_search for Ollama
    const aiResponse = await callAIWithFallback({
      model: preferred_model || 'gpt-oss:20b-cloud',
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse de coûts et pricing.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      web_search: web_search_enabled || false  // Utiliser le paramètre utilisateur
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'AI call failed');
    }

    console.log(`[ENRICH-COST] ✅ Provider used: ${aiResponse.provider}`);
    const costAnalysisRaw = aiResponse.content;
    
    console.log('[ENRICH-COST] AI response length:', costAnalysisRaw?.length || 0);

    // Try to parse JSON and validate
    let costAnalysis;
    let parseError = null;
    let validationIssues: string[] = [];
    
    try {
      costAnalysis = JSON.parse(costAnalysisRaw);
      
      // Validate the enrichment quality
      const validation = validateEnrichment('cost_analysis', costAnalysis);
      if (!validation.isValid) {
        validationIssues = validation.issues;
        console.warn('[ENRICH-COST] Validation issues found:', validationIssues);
      }
    } catch (e) {
      console.warn('[ENRICH-COST] Failed to parse JSON, storing as string');
      costAnalysis = costAnalysisRaw;
      parseError = e instanceof Error ? e.message : 'JSON parse error';
    }

    // Merge with existing analysis_result
    const currentResult = currentAnalysis.analysis_result || {};
    const newAnalysisResult = {
      ...currentResult,
      cost_analysis: costAnalysis,
      _enrichment_provider: aiResponse.provider,
      _last_enriched: new Date().toISOString(),
      ...(parseError && { cost_analysis_parse_error: parseError }),
      ...(validationIssues.length > 0 && { cost_analysis_validation_issues: validationIssues })
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
