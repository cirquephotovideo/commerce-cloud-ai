import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let analysisIdForLog: string | undefined;
  
  try {
    const { analysisId, productData, purchasePrice } = await req.json();
    analysisIdForLog = analysisId;
    
    console.log('[UNIFIED-OLLAMA] 🚀 Starting unified enrichment for:', analysisId);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Récupérer config utilisateur pour modèle préféré
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    let userId: string | null = null;
    let preferredModel = 'qwen3-coder:480b-cloud';

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: settings } = await supabase
          .from('ai_provider_configs')
          .select('default_model')
          .eq('user_id', user.id)
          .eq('provider', 'ollama')
          .maybeSingle();
        if (settings?.default_model) preferredModel = settings.default_model;
      }
    }

    console.log('[UNIFIED-OLLAMA] Using model:', preferredModel);

    // Récupérer l'analyse actuelle
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (!currentAnalysis) {
      throw new Error('Analyse non trouvée');
    }

    // Marquer TOUS les champs comme "processing" en parallèle
    await supabase
      .from('product_analyses')
      .update({
        enrichment_status: {
          specifications: 'processing',
          cost_analysis: 'processing',
          technical_description: 'processing',
          images: 'processing',
          rsgp: 'processing',
          odoo_attributes: 'processing'
        }
      })
      .eq('id', analysisId);

    // PROMPT UNIFIÉ - Un seul appel pour TOUT
    const unifiedPrompt = `Tu es un expert en catalogage e-commerce. Analyse ce produit avec recherche web approfondie.

Produit :
- Nom : ${productData.name}
- Marque : ${productData.brand || 'Inconnue'}
- EAN : ${productData.ean || 'N/A'}
- Référence : ${productData.supplier_reference || 'N/A'}
- Prix d'achat : ${purchasePrice || 'N/A'} EUR

**CONSIGNES** :
1. Recherche web approfondie sur ce produit exact
2. Extrais des données RÉELLES (pas d'invention)
3. Retourne UN SEUL JSON complet avec TOUS les champs ci-dessous

**FORMAT JSON STRICTEMENT REQUIS** :

{
  "long_description": "Description marketing détaillée 500-800 mots basée sur web",
  "specifications": {
    "dimensions": { "length": 200, "width": 5, "height": 2, "unit": "cm" },
    "weight": { "value": 0.05, "unit": "kg" },
    "materials": ["Cuivre", "PVC"],
    "certifications": ["CE", "RoHS"],
    "technical_details": "Détails techniques complets",
    "connector_type": "HDMI 2.0",
    "cable_length": "2m",
    "bandwidth": "18 Gbps"
  },
  "cost_analysis": {
    "market_price_range": { "min": 25.0, "max": 45.0, "currency": "EUR" },
    "recommended_margin": 30,
    "recommended_selling_price": 39.99,
    "analysis_notes": "Prix marché basé sur recherche web"
  },
  "hs_code": "85444290",
  "rsgp_compliance": {
    "repairability_index": 7.5,
    "environmental_score": "B",
    "certifications": ["CE", "RoHS", "REACH"],
    "safety_warnings": ["Éviter les torsions excessives"],
    "disposal_instructions": "Recyclage électronique (DEEE)",
    "warranty_info": "Garantie 2 ans constructeur",
    "maintenance_tips": "Nettoyer avec chiffon sec"
  },
  "odoo_attributes": {
    "category_name": "Audio & Video / Cables / HDMI",
    "attributes": [
      { "name": "Length", "value": "2m" },
      { "name": "Connector Type", "value": "HDMI 2.0" },
      { "name": "Color", "value": "Black" },
      { "name": "Brand", "value": "${productData.brand}" }
    ]
  },
  "image_keywords": ["hdmi cable", "kordz pro3", "high quality", "4k", "black cable"],
  "video_script": "Découvrez le câble HDMI Kordz Pro3 2m, conçu pour...",
  "web_sources": ["https://example.com/product1", "https://example.com/review2"],
  "confidence_level": "high"
}`;

    console.log('[UNIFIED-OLLAMA] ⚡ Calling Ollama Cloud with web_search=true...');

    const { data: ollamaData, error: ollamaError } = await supabase.functions.invoke('ollama-proxy', {
      body: {
        action: 'chat',
        model: preferredModel,
        web_search: true,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en catalogage e-commerce. Réponds UNIQUEMENT avec du JSON valide, sans markdown.' 
          },
          { 
            role: 'user', 
            content: unifiedPrompt 
          }
        ],
        options: {
          temperature: 0.3,
          num_predict: 4000
        }
      }
    });

    if (ollamaError) {
      console.error('[UNIFIED-OLLAMA] ❌ Ollama error:', ollamaError);
      throw new Error(`Ollama error: ${ollamaError.message || 'Unknown'}`);
    }

    console.log('[UNIFIED-OLLAMA] ✅ Ollama response received');

    // Parser la réponse
    let responseText = ollamaData?.response?.response || ollamaData?.response?.message?.content || '';
    
    // Nettoyer le markdown si présent
    responseText = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    let enrichedData;
    try {
      enrichedData = JSON.parse(responseText);
      console.log('[UNIFIED-OLLAMA] ✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('[UNIFIED-OLLAMA] ❌ JSON parse error:', parseError);
      console.log('[UNIFIED-OLLAMA] Raw response:', responseText.substring(0, 500));
      throw new Error('Impossible de parser la réponse Ollama');
    }

    // TRAITEMENT PARALLÈLE AVEC Promise.allSettled pour éviter les pertes
    console.log('[UNIFIED-OLLAMA] 🔄 Starting parallel database updates...');

    const updates = await Promise.allSettled([
      // 1. Update product_analyses
      supabase
        .from('product_analyses')
        .update({
          long_description: enrichedData.long_description || null,
          specifications: enrichedData.specifications || null,
          cost_analysis: enrichedData.cost_analysis || null,
          hs_code: enrichedData.hs_code || null,
          enrichment_status: {
            specifications: enrichedData.specifications ? 'completed' : 'failed',
            cost_analysis: enrichedData.cost_analysis ? 'completed' : 'failed',
            technical_description: enrichedData.long_description ? 'completed' : 'failed',
            images: 'pending',
            rsgp: enrichedData.rsgp_compliance ? 'completed' : 'failed',
            odoo_attributes: enrichedData.odoo_attributes ? 'completed' : 'failed'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId),

      // 2. Update/Insert RSGP compliance
      (async () => {
        if (!enrichedData.rsgp_compliance) return { data: null, error: null };
        
        const { data: existing } = await supabase
          .from('rsgp_compliance')
          .select('id')
          .eq('analysis_id', analysisId)
          .maybeSingle();

        if (existing) {
          return supabase
            .from('rsgp_compliance')
            .update({
              repairability_index: enrichedData.rsgp_compliance.repairability_index,
              environmental_score: enrichedData.rsgp_compliance.environmental_score,
              certifications: enrichedData.rsgp_compliance.certifications || [],
              safety_warnings: enrichedData.rsgp_compliance.safety_warnings || [],
              disposal_instructions: enrichedData.rsgp_compliance.disposal_instructions,
              warranty_info: enrichedData.rsgp_compliance.warranty_info,
              maintenance_tips: enrichedData.rsgp_compliance.maintenance_tips,
              updated_at: new Date().toISOString()
            })
            .eq('analysis_id', analysisId);
        } else {
          return supabase
            .from('rsgp_compliance')
            .insert({
              analysis_id: analysisId,
              user_id: userId || currentAnalysis.user_id,
              repairability_index: enrichedData.rsgp_compliance.repairability_index,
              environmental_score: enrichedData.rsgp_compliance.environmental_score,
              certifications: enrichedData.rsgp_compliance.certifications || [],
              safety_warnings: enrichedData.rsgp_compliance.safety_warnings || [],
              disposal_instructions: enrichedData.rsgp_compliance.disposal_instructions,
              warranty_info: enrichedData.rsgp_compliance.warranty_info,
              maintenance_tips: enrichedData.rsgp_compliance.maintenance_tips
            });
        }
      })(),

      // 3. Update/Insert Odoo attributes
      (async () => {
        if (!enrichedData.odoo_attributes) return { data: null, error: null };
        
        const { data: existing } = await supabase
          .from('odoo_attributes')
          .select('id')
          .eq('analysis_id', analysisId)
          .maybeSingle();

        if (existing) {
          return supabase
            .from('odoo_attributes')
            .update({
              category_name: enrichedData.odoo_attributes.category_name,
              attributes: enrichedData.odoo_attributes.attributes || [],
              enriched_at: new Date().toISOString()
            })
            .eq('analysis_id', analysisId);
        } else {
          return supabase
            .from('odoo_attributes')
            .insert({
              analysis_id: analysisId,
              user_id: userId || currentAnalysis.user_id,
              category_name: enrichedData.odoo_attributes.category_name,
              attributes: enrichedData.odoo_attributes.attributes || []
            });
        }
      })()
    ]);

    // Analyser les résultats
    const results = {
      product_analyses: updates[0].status === 'fulfilled' ? 'success' : 'failed',
      rsgp_compliance: updates[1].status === 'fulfilled' ? 'success' : 'failed',
      odoo_attributes: updates[2].status === 'fulfilled' ? 'success' : 'failed'
    };

    console.log('[UNIFIED-OLLAMA] ✅ Parallel updates completed:', results);

    // Compter les succès
    const successCount = Object.values(results).filter(r => r === 'success').length;
    const totalCount = Object.keys(results).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Enrichissement unifié terminé: ${successCount}/${totalCount} réussis`,
        results,
        enrichedFields: {
          description: !!enrichedData.long_description,
          specifications: !!enrichedData.specifications,
          cost_analysis: !!enrichedData.cost_analysis,
          hs_code: !!enrichedData.hs_code,
          rsgp: !!enrichedData.rsgp_compliance,
          odoo_attributes: !!enrichedData.odoo_attributes
        },
        webSources: enrichedData.web_sources || [],
        confidenceLevel: enrichedData.confidence_level || 'unknown'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

    console.log(`[UNIFIED OLLAMA ENRICHMENT] Produit ${analysisId} enrichi avec succès`);

    // PHASE 1: Appeler automatiquement enrich-market-pricing
    try {
      console.log('[UNIFIED OLLAMA] Calling enrich-market-pricing...');
      const pricingResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-market-pricing`,
        {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ analysis_id: analysisId, batch: true })
        }
      );
      if (pricingResponse.ok) {
        console.log('[UNIFIED OLLAMA] Market pricing enriched successfully');
      }
    } catch (error) {
      console.error('[UNIFIED OLLAMA] Error enriching market pricing:', error);
    }

    // PHASE 1: Appeler automatiquement validate-pre-export
    try {
      console.log('[UNIFIED OLLAMA] Calling validate-pre-export...');
      const validationResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-pre-export`,
        {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ analysis_id: analysisId })
        }
      );
      if (validationResponse.ok) {
        console.log('[UNIFIED OLLAMA] Pre-export validation completed');
      }
    } catch (error) {
      console.error('[UNIFIED OLLAMA] Error validating pre-export:', error);
    }

  } catch (error: any) {
    console.error('[UNIFIED-OLLAMA] ❌ Fatal error:', error.message);
    
    // Marquer comme failed en cas d'erreur
    if (analysisIdForLog) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('product_analyses')
          .update({
            enrichment_status: {
              specifications: 'failed',
              cost_analysis: 'failed',
              technical_description: 'failed',
              images: 'failed',
              rsgp: 'failed',
              odoo_attributes: 'failed'
            }
          })
          .eq('id', analysisIdForLog);
      } catch (updateError) {
        console.error('[UNIFIED-OLLAMA] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        analysisId: analysisIdForLog
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
