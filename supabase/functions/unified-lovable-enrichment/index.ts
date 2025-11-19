import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { UNIFIED_PROMPTS, callLovableAI, AI_CONFIG } from "../_shared/ai-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, enrichment_type, productData, purchasePrice } = await req.json();

    console.log(`[UNIFIED-LOVABLE] Starting ${enrichment_type} enrichment for analysis ${analysisId}`);

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

    console.log(`[UNIFIED-LOVABLE] Calling Lovable AI with model ${AI_CONFIG.model}`);

    // Call Lovable AI with retry logic
    let result;
    let lastError;
    
    for (let attempt = 1; attempt <= AI_CONFIG.retry_attempts; attempt++) {
      try {
        result = await callLovableAI(contextPrompt, systemPrompt);
        console.log(`[UNIFIED-LOVABLE] AI response received on attempt ${attempt}`);
        break;
      } catch (error) {
        lastError = error;
        console.error(`[UNIFIED-LOVABLE] Attempt ${attempt}/${AI_CONFIG.retry_attempts} failed:`, error);
        if (attempt < AI_CONFIG.retry_attempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        }
      }
    }

    if (!result) {
      throw new Error(`Failed after ${AI_CONFIG.retry_attempts} attempts: ${lastError}`);
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
          updateData.analysis_result = {
            ...analysis.analysis_result,
            specifications: result.specifications,
          };
        }
        break;

      case 'cost_analysis':
        if (result.cost_analysis) {
          updateData.cost_analysis = result.cost_analysis;
          updateData.analysis_result = {
            ...analysis.analysis_result,
            recommended_price: result.cost_analysis.recommended_selling_price,
            margin_percentage: result.cost_analysis.margin_percentage,
          };
        }
        break;

      case 'images':
        if (result.official_image_urls && Array.isArray(result.official_image_urls)) {
          // Merge with existing images
          const existingImages = analysis.official_image_urls || [];
          const newImages = result.official_image_urls.filter(
            (url: string) => !existingImages.includes(url)
          );
          updateData.official_image_urls = [...existingImages, ...newImages].slice(0, 10);
        }
        break;

      case 'rsgp':
        if (result.rsgp_compliance) {
          updateData.rsgp_compliance = result.rsgp_compliance;
          updateData.analysis_result = {
            ...analysis.analysis_result,
            repairability_score: result.rsgp_compliance.repairability_score,
          };
        }
        break;
    }

    // Update product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update(updateData)
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log(`[UNIFIED-LOVABLE] Successfully enriched ${enrichment_type} for analysis ${analysisId}`);

    return new Response(
      JSON.stringify({
        success: true,
        enrichment_type,
        data: result,
        provider: 'lovable-ai',
        model: AI_CONFIG.model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[UNIFIED-LOVABLE] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'lovable-ai',
        model: AI_CONFIG.model,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
