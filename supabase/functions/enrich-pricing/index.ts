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
    const { analysisId, productData, purchasePrice } = await req.json();
    console.log('[PRICING] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const prompt = `Recherche les prix de vente pour ce produit:
- Produit: ${productData?.name || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- EAN: ${productData?.ean || 'N/A'}
- Prix d'achat: ${purchasePrice ? `${purchasePrice}€` : 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}

Recherche les prix pratiqués par les concurrents en ligne (Amazon, Cdiscount, etc.)

Fournis en JSON:
{
  "recommended_selling_price": number (prix de vente recommandé en €),
  "market_average_price": number (prix moyen du marché en €),
  "suggested_margin_percentage": number (marge recommandée en %),
  "price_sources": ["site1.com", "site2.com"] (sources des prix trouvés)
}

IMPORTANT: Tous les prix doivent être en euros (nombre décimal). Si le prix d'achat est fourni, la marge doit permettre un bénéfice raisonnable (30-50%). Retourne UNIQUEMENT le JSON.`;

    console.log('[PRICING] Calling Ollama with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'qwen3-coder:480b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000
    });

    console.log('[PRICING] Parsing JSON response...');
    const priceData = parseJSONFromText(aiResponse.content);

    // Calculer la marge réelle si on a un prix d'achat
    let calculatedMargin = priceData.suggested_margin_percentage || null;
    if (purchasePrice && priceData.recommended_selling_price) {
      calculatedMargin = ((priceData.recommended_selling_price - purchasePrice) / purchasePrice) * 100;
    }

    const normalizedData = {
      recommended_selling_price: typeof priceData.recommended_selling_price === 'number' ? priceData.recommended_selling_price : null,
      market_average_price: typeof priceData.market_average_price === 'number' ? priceData.market_average_price : null,
      suggested_margin_percentage: calculatedMargin ? Math.round(calculatedMargin * 100) / 100 : null,
      price_sources: Array.isArray(priceData.price_sources) ? priceData.price_sources : []
    };

    console.log('[PRICING] Normalized data:', normalizedData);

    // Mettre à jour product_analyses avec merge du JSONB
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('analysis_result')
      .eq('id', analysisId)
      .single();

    const updatedAnalysisResult = {
      ...(currentAnalysis?.analysis_result || {}),
      pricing: normalizedData
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

    console.log('[PRICING] ✅ Pricing enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: normalizedData,
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PRICING] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
