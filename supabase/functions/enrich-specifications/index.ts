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
    const { analysisId, productData, preferred_model, web_search_enabled } = await req.json();
    const startTime = Date.now();
    
    console.log('[ENRICH-SPECS] 🚀 Starting specifications enrichment');
    console.log('[ENRICH-SPECS] Analysis ID:', analysisId);
    console.log('[ENRICH-SPECS] Product:', productData?.name || 'N/A');
    console.log('[ENRICH-SPECS] Model:', preferred_model || 'auto');
    console.log('[ENRICH-SPECS] Web search:', web_search_enabled || false);

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
    enrichmentStatus.specifications = 'processing';
    
    await supabase
      .from('product_analyses')
      .update({ enrichment_status: enrichmentStatus })
      .eq('id', analysisId);

    console.log('[ENRICH-SPECS] ⏳ Status set to processing');

    // Use the new comprehensive specifications prompt
    const existingSpecs = currentAnalysis.analysis_result?.specifications;
    const prompt = PromptTemplates.specifications(productData, existingSpecs);

    console.log('[ENRICH-SPECS] 🤖 Calling AI with fallback...');
    const aiCallStart = Date.now();
    
    // ✅ Use callAIWithFallback with web_search for Ollama
    const aiResponse = await callAIWithFallback({
      model: preferred_model || 'gpt-oss:20b-cloud',
      messages: [
        { role: 'system', content: 'Tu es un expert en spécifications techniques de produits.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      web_search: web_search_enabled || false  // Utiliser le paramètre utilisateur
    });

    const aiCallDuration = Date.now() - aiCallStart;
    console.log(`[ENRICH-SPECS] ✅ AI responded in ${aiCallDuration}ms`);

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'AI call failed');
    }

    console.log(`[ENRICH-SPECS] ✅ Provider used: ${aiResponse.provider}`);
    const specificationsRaw = aiResponse.content;
    
    console.log('[ENRICH-SPECS] 📊 AI response length:', specificationsRaw?.length || 0, 'chars');

    // Try to parse JSON and validate
    let specifications;
    let parseError = null;
    let validationIssues: string[] = [];
    
    try {
      specifications = JSON.parse(specificationsRaw);
      console.log('[ENRICH-SPECS] ✅ JSON parsed successfully');
      
      // Validate the enrichment quality
      const validation = validateEnrichment('specifications', specifications);
      if (!validation.isValid) {
        validationIssues = validation.issues;
        console.warn('[ENRICH-SPECS] ⚠️ Validation issues:', validationIssues);
      } else {
        console.log('[ENRICH-SPECS] ✅ Validation passed');
      }
    } catch (e) {
      console.warn('[ENRICH-SPECS] ⚠️ Failed to parse JSON, storing as string');
      specifications = specificationsRaw;
      parseError = e instanceof Error ? e.message : 'JSON parse error';
    }

    // Merge with existing analysis_result
    const currentResult = currentAnalysis.analysis_result || {};
    const newAnalysisResult = {
      ...currentResult,
      specifications,
      _enrichment_provider: aiResponse.provider,
      _last_enriched: new Date().toISOString(),
      ...(parseError && { specifications_parse_error: parseError }),
      ...(validationIssues.length > 0 && { specifications_validation_issues: validationIssues })
    };

    console.log('[ENRICH-SPECS] 💾 Saving to database...');

    // Update status to completed
    enrichmentStatus.specifications = 'completed';

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        specifications,  // ✅ Sauvegarde dans la colonne dédiée
        analysis_result: newAnalysisResult,  // ✅ + dans analysis_result pour compatibilité
        enrichment_status: enrichmentStatus
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    const totalDuration = Date.now() - startTime;
    console.log(`[ENRICH-SPECS] ✅ Specifications saved successfully in ${totalDuration}ms`);
    console.log(`[ENRICH-SPECS] 💾 Saved data preview:`, JSON.stringify(specifications).substring(0, 200) + '...');
    console.log('[ENRICH-SPECS] Status → completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        specifications,
        provider: aiResponse.provider 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-SPECS] Error:', error);
    console.error('[ENRICH-SPECS] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // ✅ Phase 5: Mark as failed but return 200 status
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
        enrichmentStatus.specifications = 'failed';
        
        await supabase
          .from('product_analyses')
          .update({
            analysis_result: {
              ...currentAnalysis.analysis_result,
              specifications_error: error instanceof Error ? error.message : 'Unknown error'
            },
            enrichment_status: enrichmentStatus
          })
          .eq('id', analysisId);
      }
    } catch (e) {
      console.error('[ENRICH-SPECS] Failed to mark as failed:', e);
    }
    
    return handleError(error, 'ENRICH-SPECS', corsHeaders);
  }
});
