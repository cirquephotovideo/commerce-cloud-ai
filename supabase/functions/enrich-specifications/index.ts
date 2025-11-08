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
    const { analysisId, productData, preferred_model, web_search_enabled } = await req.json();
    console.log('[ENRICH-SPECS] Web search:', web_search_enabled || false);
    console.log('[ENRICH-SPECS] Starting enrichment for analysis:', analysisId);
    console.log('[ENRICH-SPECS] Preferred model:', preferred_model || 'auto');

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

    console.log('[ENRICH-SPECS] Status set to processing');

    // Préparer le prompt pour les spécifications
    const prompt = `Génère des spécifications techniques détaillées pour ce produit :

Nom: ${productData?.name || 'Produit'}
Description: ${productData?.description || ''}
Données brutes: ${JSON.stringify(productData, null, 2)}

Fournis les spécifications suivantes en JSON structuré:
{
  "dimensions": { "length": "", "width": "", "height": "", "unit": "cm" },
  "weight": { "value": "", "unit": "kg" },
  "materials": [""],
  "certifications": [""],
  "standards": [""],
  "technical_details": "",
  "compatibility": "",
  "power_requirements": "",
  "operating_conditions": ""
}`;

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

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'AI call failed');
    }

    console.log(`[ENRICH-SPECS] ✅ Provider used: ${aiResponse.provider}`);
    const specificationsRaw = aiResponse.content;
    
    console.log('[ENRICH-SPECS] AI response length:', specificationsRaw?.length || 0);

    // Try to parse JSON, fallback to raw string
    let specifications;
    let parseError = null;
    try {
      specifications = JSON.parse(specificationsRaw);
    } catch (e) {
      console.warn('[ENRICH-SPECS] Failed to parse JSON, storing as string');
      specifications = specificationsRaw;
      parseError = e instanceof Error ? e.message : 'JSON parse error';
    }

    // Merge with existing analysis_result (garantir que l'objet existe)
    const currentResult = currentAnalysis.analysis_result || {};
    const newAnalysisResult = {
      ...currentResult,
      specifications,
      _enrichment_provider: aiResponse.provider,
      _last_enriched: new Date().toISOString(),
      ...(parseError && { specifications_parse_error: parseError })
    };

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

    console.log('[ENRICH-SPECS] Specifications saved successfully → completed');

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
