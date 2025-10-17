import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { analysisId, productData, purchasePrice } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[ENRICH-OLLAMA-WEB] 🔍 Starting web enrichment for:', analysisId);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Récupérer l'analyse actuelle
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    // Marquer comme "processing"
    await supabase
      .from('product_analyses')
      .update({
        enrichment_status: {
          specifications: 'processing',
          cost_analysis: 'processing',
          technical_description: 'processing',
          images: 'processing',
          rsgp: 'processing'
        }
      })
      .eq('id', analysisId);

    // PROMPT STRUCTURÉ POUR OLLAMA (avec web_search activé)
    const prompt = `Tu es un expert en catalogage produit e-commerce. Analyse ce produit et effectue une recherche web pour obtenir des informations réelles.

Produit à analyser :
- Nom : ${productData.name}
- Marque : ${productData.brand || 'Inconnue'}
- Référence : ${productData.supplier_reference || productData.ean || 'N/A'}
- Prix d'achat : ${purchasePrice || 'Non renseigné'} EUR
- EAN : ${productData.ean || 'Non disponible'}

**CONSIGNES STRICTES** :
1. Effectue une recherche web approfondie sur ce produit
2. Extrais des données RÉELLES (pas d'invention)
3. Si tu ne trouves pas d'informations précises, indique-le clairement

Réponds UNIQUEMENT avec un JSON valide suivant ce format exact :

{
  "long_description": "Description marketing détaillée de 500-800 mots basée sur les données web trouvées",
  "specifications": {
    "dimensions": { "length": null, "width": null, "height": null, "unit": "cm" },
    "weight": { "value": null, "unit": "kg" },
    "materials": [],
    "certifications": [],
    "technical_details": "Détails techniques trouvés sur le web"
  },
  "cost_analysis": {
    "market_price_range": { "min": null, "max": null, "currency": "EUR" },
    "recommended_margin": null,
    "recommended_selling_price": null,
    "analysis_notes": "Notes basées sur les prix trouvés en ligne"
  },
  "hs_code": "Code douanier suggéré (8 chiffres) ou null si introuvable",
  "rsgp_compliance": {
    "repairability_index": null,
    "environmental_score": "Inconnu",
    "certifications": []
  },
  "web_sources": ["URL1", "URL2"],
  "confidence_level": "high|medium|low"
}`;

    // APPEL OLLAMA CLOUD avec WEB SEARCH activé
    console.log('[ENRICH-OLLAMA-WEB] ⚡ Calling Ollama Cloud with web_search=true...');

    const { data: ollamaData, error: ollamaError } = await supabase.functions.invoke('ollama-proxy', {
      body: {
        action: 'chat',
        model: 'gpt-oss:120b-cloud',
        web_search: true,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un assistant qui analyse des produits et répond UNIQUEMENT en JSON valide. Tu effectues des recherches web pour obtenir des données réelles.' 
          },
          { role: 'user', content: prompt }
        ]
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (ollamaError) {
      console.error('[ENRICH-OLLAMA-WEB] ❌ Ollama error:', ollamaError);
      throw ollamaError;
    }

    if (!ollamaData?.success || !ollamaData?.response) {
      throw new Error('Invalid Ollama response structure');
    }

    console.log('[ENRICH-OLLAMA-WEB] ✅ Ollama response received');

    // EXTRAIRE LA RÉPONSE JSON
    let enrichedData;
    try {
      const content = ollamaData.response.choices?.[0]?.message?.content || 
                     ollamaData.response.message?.content;
      
      if (!content) {
        throw new Error('No content in Ollama response');
      }

      // Parser le JSON (nettoyer les backticks si présents)
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      enrichedData = JSON.parse(cleanContent);
      
      console.log('[ENRICH-OLLAMA-WEB] 📊 Parsed JSON successfully');
    } catch (parseError) {
      console.error('[ENRICH-OLLAMA-WEB] ❌ JSON parse failed:', parseError);
      throw new Error(`Failed to parse Ollama JSON response: ${parseError.message}`);
    }

    // MISE À JOUR DE LA BASE DE DONNÉES
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        long_description: enrichedData.long_description,
        specifications: enrichedData.specifications,
        cost_analysis: enrichedData.cost_analysis,
        analysis_result: {
          ...currentAnalysis.analysis_result,
          hs_code: enrichedData.hs_code,
          rsgp_compliance: enrichedData.rsgp_compliance,
          _enriched_with_ollama_web: true,
          _web_search_timestamp: new Date().toISOString(),
          _web_sources: enrichedData.web_sources || [],
          _confidence_level: enrichedData.confidence_level || 'medium'
        },
        enrichment_status: {
          specifications: 'completed',
          cost_analysis: 'completed',
          technical_description: 'completed',
          images: 'completed',
          rsgp: 'completed'
        }
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[ENRICH-OLLAMA-WEB] ✅ Product enriched successfully with Ollama web search');

    return new Response(
      JSON.stringify({
        success: true,
        enrichedData,
        web_sources: enrichedData.web_sources,
        confidence_level: enrichedData.confidence_level
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ENRICH-OLLAMA-WEB] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
