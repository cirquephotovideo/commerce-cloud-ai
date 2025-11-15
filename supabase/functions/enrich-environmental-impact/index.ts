import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOllamaWithWebSearch } from "../_shared/ollama-client.ts";
import { parseJSONFromText } from "../_shared/json-parser.ts";

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
    console.log('[ENV-IMPACT] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Construire le prompt
    const prompt = `Recherche web et analyse les données environnementales pour ce produit:
- Nom: ${productData?.name || 'N/A'}
- EAN: ${productData?.ean || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}

Fournis les informations suivantes en JSON:
{
  "eco_score": number (0-100, basé sur l'impact environnemental global),
  "carbon_footprint": "X kg CO2" (ou "N/A" si non trouvé),
  "recyclability": "description du niveau de recyclabilité" (ou "Non spécifié"),
  "eco_certifications": ["ISO 14001", "..."] (array de certifications trouvées, ou [])
}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

    console.log('[ENV-IMPACT] Calling Ollama with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'qwen3-coder:480b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000
    });

    console.log('[ENV-IMPACT] Parsing JSON response...');
    const envData = parseJSONFromText(aiResponse.content);

    // Valider et normaliser les données
    const normalizedData = {
      eco_score: typeof envData.eco_score === 'number' ? Math.max(0, Math.min(100, envData.eco_score)) : 0,
      carbon_footprint: envData.carbon_footprint || 'N/A',
      recyclability: envData.recyclability || 'Non spécifié',
      eco_certifications: Array.isArray(envData.eco_certifications) ? envData.eco_certifications : []
    };

    console.log('[ENV-IMPACT] Normalized data:', normalizedData);

    // Mettre à jour product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: supabase.rpc('jsonb_set', {
          target: 'analysis_result',
          path: '{environmental_impact}',
          new_value: JSON.stringify(normalizedData)
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      throw updateError;
    }

    console.log('[ENV-IMPACT] ✅ Environmental impact enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: normalizedData,
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENV-IMPACT] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
