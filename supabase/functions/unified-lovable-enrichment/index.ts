import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { UNIFIED_PROMPTS, callLovableAI, AI_CONFIG } from "../_shared/ai-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const requestStartTime = Date.now(); // Définir au début pour l'avoir dans le catch
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, enrichment_type, productData, purchasePrice } = await req.json();

    console.log(`[UNIFIED-LOVABLE] 🚀 ============ REQUEST START ============`);
    console.log(`[UNIFIED-LOVABLE] ⏱️ Timestamp: ${new Date().toISOString()}`);
    console.log(`[UNIFIED-LOVABLE] 📊 Type: ${enrichment_type}`);
    console.log(`[UNIFIED-LOVABLE] 🆔 Analysis ID: ${analysisId}`);
    console.log(`[UNIFIED-LOVABLE] 📦 Product: ${productData?.product_name || 'Unknown'}`);

    // Validate enrichment_type
    const validTypes = ['description', 'specifications', 'cost_analysis', 'images', 'rsgp'];
    if (!validTypes.includes(enrichment_type)) {
      throw new Error(`Invalid enrichment_type: ${enrichment_type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current product analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError) throw analysisError;

    // Build context prompt from available data
    const productInfo = {
      name: productData?.product_name || analysis.analysis_result?.name || 'Produit sans nom',
      ean: productData?.ean || analysis.ean || 'Non disponible',
      brand: analysis.analysis_result?.brand || 'Non spécifié',
      category: analysis.analysis_result?.category || 'Non spécifiée',
      existing_description: analysis.long_description || '',
      existing_specs: JSON.stringify(analysis.specifications || {}),
      purchase_price: purchasePrice || productData?.purchase_price || 0,
    };

    const contextPrompt = `
CONTEXTE PRODUIT :
- Nom : ${productInfo.name}
- EAN : ${productInfo.ean}
- Marque : ${productInfo.brand}
- Catégorie : ${productInfo.category}
${purchasePrice ? `- Prix d'achat : ${purchasePrice} EUR` : ''}

${productInfo.existing_description ? `Description existante : ${productInfo.existing_description}` : ''}
${productInfo.existing_specs !== '{}' ? `Spécifications existantes : ${productInfo.existing_specs}` : ''}

${UNIFIED_PROMPTS[enrichment_type as keyof typeof UNIFIED_PROMPTS]}
`;

    const systemPrompt = `Tu es un expert en catalogage produit e-commerce utilisant ${AI_CONFIG.model}. Tu réponds UNIQUEMENT en JSON valide sans texte additionnel.`;

    console.log(`[UNIFIED-LOVABLE] 🤖 Calling Lovable AI with model ${AI_CONFIG.model}`);
    const aiStartTime = Date.now();

    // Call Lovable AI with retry logic
    let result;
    let lastError;
    
    for (let attempt = 1; attempt <= AI_CONFIG.retry_attempts; attempt++) {
      try {
        console.log(`[UNIFIED-LOVABLE] 🔄 AI Attempt ${attempt}/${AI_CONFIG.retry_attempts}...`);
        result = await callLovableAI(contextPrompt, systemPrompt);
        const aiDuration = Date.now() - aiStartTime;
        console.log(`[UNIFIED-LOVABLE] ✅ AI response received in ${aiDuration}ms`);
        console.log(`[UNIFIED-LOVABLE] 📄 Response preview:`, JSON.stringify(result).substring(0, 200) + '...');
        break;
      } catch (error) {
        lastError = error;
        const aiDuration = Date.now() - aiStartTime;
        console.error(`[UNIFIED-LOVABLE] ❌ Attempt ${attempt} failed after ${aiDuration}ms:`, error);
        if (attempt < AI_CONFIG.retry_attempts) {
          const backoffMs = 2000 * attempt;
          console.log(`[UNIFIED-LOVABLE] ⏳ Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!result) {
      const totalAiDuration = Date.now() - aiStartTime;
      throw new Error(`Failed after ${AI_CONFIG.retry_attempts} attempts (${totalAiDuration}ms total): ${lastError}`);
    }

    // Update database based on enrichment_type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    switch (enrichment_type) {
      case 'description':
        if (result.long_description) {
          updateData.long_description = result.long_description;
          updateData.analysis_result = {
            ...analysis.analysis_result,
            description: result.long_description,
          };
        }
        break;

      case 'specifications':
        if (result.specifications) {
          updateData.specifications = result.specifications;
        }
        break;

      case 'cost_analysis':
        if (result.cost_analysis) {
          updateData.cost_analysis = result.cost_analysis;
          updateData.analysis_result = {
            ...analysis.analysis_result,
            recommended_price: result.cost_analysis.recommended_selling_price,
          };
        }
        break;

      case 'images':
        if (result.official_image_urls && Array.isArray(result.official_image_urls)) {
          updateData.official_image_urls = result.official_image_urls;
        }
        break;

      case 'rsgp':
        if (result.rsgp_compliance) {
          updateData.rsgp_compliance = result.rsgp_compliance;
          
          // IMPORTANT : Remplir analysis_result pour l'UI
          updateData.analysis_result = {
            ...analysis.analysis_result,
            repairability: result.repairability,
            environmental_impact: result.environmental_impact,
            hs_code: result.hs_code,
            repairability_score: result.rsgp_compliance.repairability_score,
          };
        }
        break;
    }

    // Ajouter web_sources et confidence_level pour TOUS les types
    updateData.web_sources = result.web_sources || analysis.web_sources || [];
    
    // S'assurer que confidence_level est toujours une string simple
    let confidenceValue = result.confidence_level || 'medium';
    if (typeof confidenceValue === 'object' && confidenceValue !== null) {
      // Si c'est un objet, extraire la valeur 'overall' ou utiliser 'medium'
      confidenceValue = confidenceValue.overall || 'medium';
    }
    updateData.confidence_level = confidenceValue;

    // Update product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update(updateData)
      .eq('id', analysisId);

    if (updateError) {
      console.error(`[UNIFIED-LOVABLE] ❌ Database update failed:`, updateError);
      throw updateError;
    }

    const duration = Date.now() - requestStartTime;
    console.log(`[UNIFIED-LOVABLE] ✅ ============ REQUEST SUCCESS ============`);
    console.log(`[UNIFIED-LOVABLE] ⏱️ Total duration: ${duration}ms`);
    console.log(`[UNIFIED-LOVABLE] 📊 Type: ${enrichment_type}`);
    console.log(`[UNIFIED-LOVABLE] 🆔 Analysis ID: ${analysisId}`);
    console.log(`[UNIFIED-LOVABLE] 🎯 Model: ${AI_CONFIG.model}`);

    return new Response(
      JSON.stringify({
        success: true,
        enrichment_type,
        model_used: AI_CONFIG.model,
        duration_ms: duration,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const duration = Date.now() - requestStartTime;
    console.error(`[UNIFIED-LOVABLE] ❌ ============ REQUEST FAILED ============`);
    console.error(`[UNIFIED-LOVABLE] ⏱️ Failed after: ${duration}ms`);
    console.error(`[UNIFIED-LOVABLE] 🔥 Error:`, error);
    console.error(`[UNIFIED-LOVABLE] 📚 Stack:`, error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'lovable-ai',
        model: AI_CONFIG.model,
        duration_ms: duration,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
