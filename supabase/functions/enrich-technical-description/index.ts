import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, productData, preferred_model } = await req.json();
    console.log('[ENRICH-TECH-DESC] Starting for:', analysisId);
    console.log('[ENRICH-TECH-DESC] Preferred model:', preferred_model || 'auto');

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
    enrichmentStatus.technical_description = 'processing';
    
    await supabase
      .from('product_analyses')
      .update({ enrichment_status: enrichmentStatus })
      .eq('id', analysisId);

    console.log('[ENRICH-TECH-DESC] Status set to processing');

    const prompt = `Génère une description technique longue et détaillée (500-1000 mots) pour ce produit :

Nom: ${productData?.name || 'Produit'}
Description courte: ${productData?.description || ''}
Données: ${JSON.stringify(productData, null, 2)}

La description doit inclure:
- Caractéristiques techniques avancées
- Cas d'usage professionnels
- Compatibilités système
- Avantages techniques par rapport à la concurrence
- Recommandations d'installation/utilisation
- Maintenance et durabilité

Format: Texte structuré en paragraphes avec sous-titres.`;

    // ✅ Use callAIWithFallback
    const aiResponse = await callAIWithFallback({
      model: preferred_model || 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Tu es un rédacteur technique expert spécialisé dans les descriptions produits B2B.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 3000
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'AI call failed');
    }

    console.log(`[ENRICH-TECH-DESC] ✅ Provider used: ${aiResponse.provider}`);
    const technicalDescription = aiResponse.content;
    
    console.log('[ENRICH-TECH-DESC] AI response length:', technicalDescription?.length || 0);

    // Merge with existing analysis_result
    const newAnalysisResult = {
      ...currentAnalysis.analysis_result,
      technical_description: technicalDescription,
      _enrichment_provider: aiResponse.provider
    };

    // Update status to completed
    enrichmentStatus.technical_description = 'completed';

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        long_description: technicalDescription,  // ✅ Sauvegarde dans la colonne dédiée
        analysis_result: newAnalysisResult,  // ✅ + dans analysis_result pour compatibilité
        enrichment_status: enrichmentStatus
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-TECH-DESC] Technical description saved → completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        technicalDescription,
        provider: aiResponse.provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-TECH-DESC] Error:', error);
    console.error('[ENRICH-TECH-DESC] Error details:', {
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
        enrichmentStatus.technical_description = 'failed';
        
        await supabase
          .from('product_analyses')
          .update({
            analysis_result: {
              ...currentAnalysis.analysis_result,
              technical_description_error: error instanceof Error ? error.message : 'Unknown error'
            },
            enrichment_status: enrichmentStatus
          })
          .eq('id', analysisId);
      }
    } catch (e) {
      console.error('[ENRICH-TECH-DESC] Failed to mark as failed:', e);
    }
    
    // ✅ Return 200 with success: false
    return new Response(
      JSON.stringify({ 
        success: false,
        partial: true,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
