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
    const { analysisId, productData } = await req.json();
    console.log('[ENRICH-TECH-DESC] Starting for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un rédacteur technique expert spécialisé dans les descriptions produits B2B.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await response.json();
    const technicalDescription = aiData.choices[0]?.message?.content;
    
    console.log('[ENRICH-TECH-DESC] AI response length:', technicalDescription?.length || 0);

    // Merge with existing analysis_result
    const newAnalysisResult = {
      ...currentAnalysis.analysis_result,
      technical_description: technicalDescription
    };

    // Update status to completed
    enrichmentStatus.technical_description = 'completed';

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: newAnalysisResult,
        enrichment_status: enrichmentStatus
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-TECH-DESC] Technical description saved → completed');

    return new Response(
      JSON.stringify({ success: true, technicalDescription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-TECH-DESC] Error:', error);
    
    // Mark as failed
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
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
