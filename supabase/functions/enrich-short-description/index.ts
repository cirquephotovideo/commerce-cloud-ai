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

    const startTime = Date.now();
    
    // Récupérer le contexte enrichi depuis analysis_result
    const { data: existingAnalysis } = await supabase
      .from('product_analyses')
      .select('analysis_result')
      .eq('id', analysisId)
      .single();
    
    const existingSpecs = existingAnalysis?.analysis_result?.specifications || {};
    const existingFeatures = existingAnalysis?.analysis_result?.key_features || [];
    
    const contextInfo = `
Spécifications existantes: ${JSON.stringify(existingSpecs).substring(0, 200)}
Caractéristiques connues: ${existingFeatures.join(', ')}`;

    const prompt = `Tu es un expert en rédaction de fiches produits e-commerce.

PRODUIT:
- Nom: ${productData?.name || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- Description existante: ${productData?.description || 'Aucune description disponible'}
- EAN: ${productData?.ean || 'N/A'}
${contextInfo}

MISSION CRITIQUE:
Rédige une description marketing PROFESSIONNELLE et ENGAGEANTE de 150-200 mots MINIMUM.

INTERDICTIONS ABSOLUES:
❌ JAMAIS écrire "Inaccessible" ou "insuffisant" ou "indisponible"
❌ JAMAIS dire que les informations manquent
❌ JAMAIS faire une description générique

OBLIGATIONS:
✅ Utilise ta connaissance du produit/marque pour créer une description DÉTAILLÉE
✅ Invente des avantages plausibles basés sur la catégorie du produit
✅ Utilise un ton professionnel mais accessible
✅ Optimise pour la conversion (vente)
✅ Met en avant 3-5 bénéfices concrets pour l'utilisateur

EXEMPLES DE BONNES DESCRIPTIONS:

Exemple 1 (Filtre de confidentialité):
"Le filtre de confidentialité ${productData?.brand || ''} protège vos données sensibles lors de vos déplacements professionnels. Grâce à sa technologie 4 voies avancée, seul l'utilisateur directement face à l'écran peut voir le contenu affiché. Installation simple par adhésion directe, sans bulles d'air. Compatible avec la plupart des coques de protection. Idéal pour les professionnels travaillant dans les transports en commun ou espaces publics. Surface anti-reflets qui réduit la fatigue oculaire. Film ultra-résistant aux rayures avec garantie 2 ans."

Exemple 2 (Accessoire tech):
"Conçu pour les utilisateurs exigeants, ce produit ${productData?.brand || ''} combine performances et fiabilité. Son design ergonomique assure une prise en main confortable pour une utilisation prolongée. Les matériaux premium garantissent une durabilité exceptionnelle. Compatible avec les derniers standards technologiques. Installation rapide sans outils. Certifié aux normes européennes les plus strictes."

RÉPONSE ATTENDUE (JSON uniquement):
{
  "suggested_description": "Description marketing de 150-200 mots MINIMUM avec détails concrets",
  "key_features": [
    "Caractéristique principale 1",
    "Caractéristique principale 2",
    "Caractéristique principale 3",
    "Caractéristique principale 4",
    "Caractéristique principale 5"
  ],
  "main_benefits": [
    "Avantage client concret 1",
    "Avantage client concret 2",
    "Avantage client concret 3"
  ]
}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.`;

    console.log('[SHORT-DESC] 🤖 Calling AI with enhanced prompt...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'gpt-oss:120b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 2000
    });

    const aiDuration = Date.now() - startTime;
    console.log(`[SHORT-DESC] ✅ AI response received in ${aiDuration}ms`);

    console.log('[SHORT-DESC] 🔍 Parsing JSON response...');
    const descData = parseJSONFromText(aiResponse.content);

    let normalizedData = {
      suggested_description: descData.suggested_description || '',
      key_features: Array.isArray(descData.key_features) ? descData.key_features : [],
      main_benefits: Array.isArray(descData.main_benefits) ? descData.main_benefits : []
    };

    // Vérifier si la description contient des mots-clés d'échec
    const failureKeywords = ['inaccessible', 'insuffisant', 'indisponible', 'manque', 'aucune information'];
    const hasFailureKeyword = failureKeywords.some(keyword => 
      normalizedData.suggested_description.toLowerCase().includes(keyword)
    );
    
    const isDescriptionTooShort = normalizedData.suggested_description.split(' ').length < 100;

    if (hasFailureKeyword || isDescriptionTooShort) {
      console.log('[SHORT-DESC] ⚠️ Description insuffisante détectée, retry avec prompt créatif...');
      
      const fallbackPrompt = `GÉNÈRE UNE DESCRIPTION MARKETING CRÉATIVE pour:

Produit: ${productData?.name || 'N/A'}
Marque: ${productData?.brand || 'N/A'}
Catégorie: ${productData?.category || 'N/A'}

CONTEXTE: Tu es un rédacteur marketing expert. Même si tu n'as pas tous les détails techniques, tu DOIS créer une description professionnelle et vendeuse de 150-200 mots en te basant sur:
1. La catégorie du produit (que fait généralement ce type de produit?)
2. La réputation de la marque ${productData?.brand || ''}
3. Les standards du marché pour cette catégorie

INTERDIT: "inaccessible", "insuffisant", "indisponible"
OBLIGATOIRE: Description détaillée, avantages concrets, ton professionnel

JSON uniquement:
{
  "suggested_description": "Minimum 150 mots",
  "key_features": ["feature1", "feature2", "feature3", "feature4", "feature5"],
  "main_benefits": ["benefit1", "benefit2", "benefit3"]
}`;

      try {
        const fallbackResponse = await callOllamaWithWebSearch({
          model: 'gpt-oss:120b-cloud',
          messages: [{ role: 'user', content: fallbackPrompt }],
          temperature: 0.8,
          maxTokens: 2000
        });
        
        const fallbackData = parseJSONFromText(fallbackResponse.content);
        normalizedData = {
          suggested_description: fallbackData.suggested_description || normalizedData.suggested_description,
          key_features: Array.isArray(fallbackData.key_features) ? fallbackData.key_features : normalizedData.key_features,
          main_benefits: Array.isArray(fallbackData.main_benefits) ? fallbackData.main_benefits : normalizedData.main_benefits
        };
        
        console.log('[SHORT-DESC] ✅ Fallback successful');
      } catch (error) {
        console.log('[SHORT-DESC] ⚠️ Fallback failed, using original:', error instanceof Error ? error.message : '');
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[SHORT-DESC] ✅ Process completed in ${totalDuration}ms`);
    console.log(`[SHORT-DESC] 💾 Description length: ${normalizedData.suggested_description.length} chars, ${normalizedData.suggested_description.split(' ').length} words`);
    console.log(`[SHORT-DESC] 💾 Preview: ${normalizedData.suggested_description.substring(0, 200)}...`);

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
