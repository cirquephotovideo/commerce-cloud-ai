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
    const { analysisId, productData, purchasePrice } = await req.json();
    console.log('[ENRICH-COST] Starting cost analysis for:', analysisId);

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un expert en analyse de coûts et pricing.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await response.json();
    const costAnalysisRaw = aiData.choices[0]?.message?.content;
    
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

    // Merge with existing analysis_result
    const newAnalysisResult = {
      ...currentAnalysis.analysis_result,
      cost_analysis: costAnalysis,
      ...(parseError && { cost_analysis_parse_error: parseError })
    };

    // Update status to completed
    enrichmentStatus.cost_analysis = 'completed';

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: newAnalysisResult,
        enrichment_status: enrichmentStatus
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-COST] Cost analysis saved → completed');

    return new Response(
      JSON.stringify({ success: true, costAnalysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-COST] Error:', error);
    
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
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
