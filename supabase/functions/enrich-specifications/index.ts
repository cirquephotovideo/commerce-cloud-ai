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
    console.log('[ENRICH-SPECS] Starting enrichment for analysis:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un expert en spécifications techniques de produits.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await response.json();
    const specifications = aiData.choices[0]?.message?.content;

    // Sauvegarder dans product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: supabase.rpc('jsonb_set', {
          target: 'analysis_result',
          path: '{specifications}',
          new_value: specifications
        })
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-SPECS] Specifications saved successfully');

    return new Response(
      JSON.stringify({ success: true, specifications }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-SPECS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
