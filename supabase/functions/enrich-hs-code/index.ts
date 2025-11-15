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
    console.log('[HS-CODE] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const prompt = `Recherche le code douanier harmonisé (HS Code) pour ce produit:
- Produit: ${productData?.name || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}
- Description: ${productData?.description || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}

Fournis en JSON:
{
  "code": "12345678" (8 chiffres, format HS Code international),
  "description": "Description officielle de la catégorie douanière",
  "category": "Nom de la catégorie douanière principale"
}

IMPORTANT: Le code DOIT avoir exactement 8 chiffres. Retourne UNIQUEMENT le JSON.`;

    console.log('[HS-CODE] Calling Ollama with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'qwen3-coder:480b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 800
    });

    console.log('[HS-CODE] Parsing JSON response...');
    const hsData = parseJSONFromText(aiResponse.content);

    // Valider le code HS (8 chiffres)
    const codeStr = String(hsData.code || '').replace(/\D/g, '');
    const validCode = codeStr.length === 8 ? codeStr : null;

    const normalizedData = {
      code: validCode || 'N/A',
      description: hsData.description || 'N/A',
      category: hsData.category || 'N/A'
    };

    console.log('[HS-CODE] Normalized data:', normalizedData);

    // Mettre à jour product_analyses avec merge du JSONB
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('analysis_result')
      .eq('id', analysisId)
      .single();

    const updatedAnalysisResult = {
      ...(currentAnalysis?.analysis_result || {}),
      hs_code: normalizedData
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

    console.log('[HS-CODE] ✅ HS Code enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: normalizedData,
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HS-CODE] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
