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

    const prompt = `Génère une description courte marketing professionnelle (150-200 mots) pour ce produit:
- Produit: ${productData?.name || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- Informations techniques: ${productData?.description || 'N/A'}

Fournis en JSON:
{
  "suggested_description": "Description marketing engageante de 150-200 mots qui met en avant les avantages et caractéristiques principales",
  "key_features": ["Caractéristique 1", "Caractéristique 2", ...] (5-7 points clés),
  "main_benefits": ["Avantage 1", "Avantage 2", ...] (3-5 avantages pour le client)
}

IMPORTANT: La description doit être accrocheuse, professionnelle et optimisée pour la vente. Retourne UNIQUEMENT le JSON.`;

    console.log('[SHORT-DESC] Calling Ollama with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'qwen3-coder:480b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 1500
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
