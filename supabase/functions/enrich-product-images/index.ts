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
    console.log('[IMAGES] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const prompt = `Recherche des images officielles de haute qualité pour ce produit:
- Produit: ${productData?.name || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- EAN: ${productData?.ean || 'N/A'}

Trouve des URLs d'images officielles du produit (photos du fabricant, site officiel, etc.)

Fournis en JSON:
{
  "image_urls": ["https://...", "https://..."] (array d'URLs d'images de haute qualité),
  "image_sources": ["site1.com", "site2.com"] (array des sites sources)
}

IMPORTANT: Fournis des URLs réelles et accessibles. Retourne UNIQUEMENT le JSON.`;

    console.log('[IMAGES] Calling Ollama with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'qwen3-coder:480b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1500
    });

    console.log('[IMAGES] Parsing JSON response...');
    const imageData = parseJSONFromText(aiResponse.content);

    // Valider les URLs
    const validUrls = Array.isArray(imageData.image_urls) 
      ? imageData.image_urls.filter((url: string) => {
          try {
            new URL(url);
            return url.startsWith('http');
          } catch {
            return false;
          }
        })
      : [];

    const normalizedData = {
      image_urls: validUrls,
      image_sources: Array.isArray(imageData.image_sources) ? imageData.image_sources : []
    };

    console.log('[IMAGES] Found', validUrls.length, 'valid image URLs');

    // Mettre à jour product_analyses avec les nouvelles images
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('image_urls')
      .eq('id', analysisId)
      .single();

    const existingUrls = currentAnalysis?.image_urls || [];
    const mergedUrls = [...new Set([...existingUrls, ...validUrls])]; // Dédupliquer

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        image_urls: mergedUrls,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      throw updateError;
    }

    console.log('[IMAGES] ✅ Image enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          ...normalizedData,
          total_images: mergedUrls.length
        },
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMAGES] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
