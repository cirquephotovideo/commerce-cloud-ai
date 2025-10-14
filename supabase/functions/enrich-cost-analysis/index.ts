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
    const costAnalysis = aiData.choices[0]?.message?.content;

    // Sauvegarder
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: supabase.rpc('jsonb_set', {
          target: 'analysis_result',
          path: '{cost_analysis}',
          new_value: costAnalysis
        })
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-COST] Cost analysis saved');

    return new Response(
      JSON.stringify({ success: true, costAnalysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-COST] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
