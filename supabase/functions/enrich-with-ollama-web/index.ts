import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let analysisIdForError: string | undefined;
  
  try {
    const { analysisId, productData, purchasePrice } = await req.json();
    analysisIdForError = analysisId;
    
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
        model: 'qwen3-coder:480b-cloud', // Modèle plus stable pour extraction structurée
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

    let finalData = ollamaData;
    let usedFallback = false;

    // ✅ CRITICAL FIX: Use callAIWithFallback for proper provider management
    if (ollamaError || !ollamaData?.success || !ollamaData?.response) {
      console.warn('[ENRICH-OLLAMA-WEB] ⚠️ Ollama failed, using automatic fallback (Lovable AI → OpenAI → OpenRouter)...', {
        ollamaError: ollamaError?.message,
        ollamaDataValid: !!ollamaData?.success
      });

      // Import shared AI fallback
      const { callAIWithFallback } = await import('../_shared/ai-fallback.ts');

      // Mettre à jour enrichment_queue
      await supabase
        .from('enrichment_queue')
        .update({
          error_message: `Ollama Cloud error: ${ollamaError?.message || 'Invalid response'}. Using fallback providers...`,
          last_error: {
            timestamp: new Date().toISOString(),
            provider: 'ollama-cloud',
            model: 'qwen3-coder:480b-cloud',
            error: ollamaError?.message || 'Invalid response structure'
          }
        })
        .eq('analysis_id', analysisId)
        .in('enrichment_type', [['specifications'], ['cost_analysis'], ['technical_description']]);

      try {
        const fallbackResponse = await callAIWithFallback({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'Tu es un assistant qui analyse des produits et répond UNIQUEMENT en JSON valide. Utilise tes connaissances pour enrichir les données produit.' 
            },
            { role: 'user', content: prompt }
          ]
        }, { skipProviders: ['ollama'] }); // Skip Ollama since it already failed

        if (!fallbackResponse.success) {
          throw new Error(`All fallback providers failed: ${fallbackResponse.error}`);
        }

        console.log(`[ENRICH-OLLAMA-WEB] ✅ Fallback succeeded with provider: ${fallbackResponse.provider}`);
        // Transform response to match expected format
        finalData = {
          success: true,
          choices: fallbackResponse.content ? [{ message: { content: fallbackResponse.content } }] : []
        };
        usedFallback = true;
      } catch (fallbackError: any) {
        console.error('[ENRICH-OLLAMA-WEB] ❌ All providers failed:', fallbackError);
        
        // Marquer comme failed dans enrichment_queue
        await supabase
          .from('enrichment_queue')
          .update({
            status: 'failed',
            error_message: `All AI providers failed. Ollama: ${ollamaError?.message}. Fallback: ${fallbackError.message}`,
            completed_at: new Date().toISOString()
          })
          .eq('analysis_id', analysisId);

        // Return 200 with structured error
        return new Response(
          JSON.stringify({ 
            success: false,
            code: 'PROVIDER_DOWN',
            http_status: 503,
            message: 'Tous les providers IA sont indisponibles',
            details: fallbackError.message
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    }

    if (!finalData?.success && !finalData?.choices?.[0]?.message?.content && !finalData?.message?.content) {
      throw new Error('Invalid AI response structure from both providers');
    }

    console.log('[ENRICH-OLLAMA-WEB] ✅ AI response received', { usedFallback, provider: usedFallback ? 'lovable-ai' : 'ollama' });

    // EXTRAIRE LA RÉPONSE JSON
    let enrichedData;
    try {
      // Gérer les deux formats de réponse (Ollama et Lovable AI)
      const content = usedFallback
        ? (finalData.choices?.[0]?.message?.content || finalData.message?.content)
        : (finalData.response?.choices?.[0]?.message?.content || finalData.response?.message?.content);
      
      if (!content) {
        throw new Error('No content in AI response');
      }

      // Parser le JSON (nettoyer les backticks si présents)
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      enrichedData = JSON.parse(cleanContent);
      
      console.log('[ENRICH-OLLAMA-WEB] 📊 Parsed JSON successfully', { usedFallback });
    } catch (parseError: any) {
      console.error('[ENRICH-OLLAMA-WEB] ❌ JSON parse failed:', parseError);
      
      // Mettre à jour enrichment_queue avec l'erreur de parsing
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'failed',
          error_message: `Failed to parse AI JSON response: ${parseError?.message || 'Unknown error'}`,
          completed_at: new Date().toISOString()
        })
        .eq('analysis_id', analysisId);
      
      throw new Error(`Failed to parse AI JSON response: ${parseError?.message || 'Unknown error'}`);
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
        confidence_level: enrichedData.confidence_level,
        provider_used: usedFallback ? 'lovable-ai' : 'ollama-cloud'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ENRICH-OLLAMA-WEB] ❌ Fatal error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Mettre à jour enrichment_queue avec l'erreur fatale
    if (analysisIdForError) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabase
          .from('enrichment_queue')
          .update({
            status: 'failed',
            error_message: `Fatal error: ${error.message}`,
            completed_at: new Date().toISOString(),
            last_error: {
              timestamp: new Date().toISOString(),
              type: 'fatal',
              message: error.message,
              stack: error.stack?.substring(0, 500)
            }
          })
          .eq('analysis_id', analysisIdForError);
      } catch (updateError) {
        console.error('[ENRICH-OLLAMA-WEB] Failed to update queue with error:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack?.substring(0, 200)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
