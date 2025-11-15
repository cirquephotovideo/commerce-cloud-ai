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
    console.log('[SHORT-DESC] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const prompt = `Tu es un expert en rédaction de fiches produits e-commerce.

PRODUIT:
- Nom: ${productData?.name || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- Description existante: ${productData?.description || 'Aucune description disponible'}
- EAN: ${productData?.ean || 'N/A'}

MISSION:
Rédige une description marketing professionnelle et engageante de 150-200 mots qui:
1. Met en avant les caractéristiques principales du produit
2. Explique les avantages concrets pour l'utilisateur
3. Utilise un ton professionnel mais accessible
4. Optimise pour la conversion (vente)

Même si peu d'informations sont disponibles, utilise ta connaissance du produit/marque pour créer une description pertinente et attractive.

RÉPONSE ATTENDUE (JSON uniquement):
{
  "suggested_description": "Description marketing de 150-200 mots",
  "key_features": [
    "Caractéristique principale 1",
    "Caractéristique principale 2",
    "Caractéristique principale 3",
    "Caractéristique principale 4",
    "Caractéristique principale 5"
  ],
  "main_benefits": [
    "Avantage client 1",
    "Avantage client 2",
    "Avantage client 3"
  ]
}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.`;

    console.log('[SHORT-DESC] Calling Ollama Cloud with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'gpt-oss:120b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 2000
    });

    console.log('[SHORT-DESC] Parsing JSON response...');
    const descData = parseJSONFromText(aiResponse.content);

    const normalizedData = {
      suggested_description: descData.suggested_description || '',
      key_features: Array.isArray(descData.key_features) ? descData.key_features : [],
      main_benefits: Array.isArray(descData.main_benefits) ? descData.main_benefits : []
    };

    console.log('[SHORT-DESC] Normalized data:', normalizedData);

    // Mettre à jour product_analyses avec merge du JSONB
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('analysis_result')
      .eq('id', analysisId)
      .single();

    const updatedAnalysisResult = {
      ...(currentAnalysis?.analysis_result || {}),
      description: normalizedData
    };

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        analysis_result: updatedAnalysisResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      throw updateError;
    }

    console.log('[SHORT-DESC] ✅ Short description enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: normalizedData,
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SHORT-DESC] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
