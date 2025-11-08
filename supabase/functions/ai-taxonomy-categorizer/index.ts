import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Taxonomies intégrées directement pour éviter les erreurs fetch
const GOOGLE_TAXONOMY = {"version":"2024-10","categories":[{"id":"1","path":"Animaux et fournitures pour animaux","parent_id":null},{"id":"2","path":"Animaux et fournitures pour animaux > Fournitures pour animaux","parent_id":"1"},{"id":"3","path":"Animaux et fournitures pour animaux > Nourriture pour animaux","parent_id":"1"},{"id":"4","path":"Art et divertissement","parent_id":null},{"id":"5","path":"Art et divertissement > Musique","parent_id":"4"},{"id":"6","path":"Vêtements et accessoires","parent_id":null},{"id":"7","path":"Vêtements et accessoires > Vêtements","parent_id":"6"},{"id":"8","path":"Vêtements et accessoires > Chaussures","parent_id":"6"},{"id":"9","path":"Électronique","parent_id":null},{"id":"10","path":"Électronique > Ordinateurs et tablettes","parent_id":"9"},{"id":"11","path":"Électronique > Téléphones et accessoires","parent_id":"9"},{"id":"12","path":"Électronique > Audio et vidéo","parent_id":"9"},{"id":"13","path":"Maison et jardin","parent_id":null},{"id":"14","path":"Maison et jardin > Meubles","parent_id":"13"},{"id":"15","path":"Maison et jardin > Décoration","parent_id":"13"},{"id":"16","path":"Beauté et soins personnels","parent_id":null},{"id":"17","path":"Beauté et soins personnels > Maquillage","parent_id":"16"},{"id":"18","path":"Beauté et soins personnels > Soins de la peau","parent_id":"16"},{"id":"19","path":"Sports et plein air","parent_id":null},{"id":"20","path":"Sports et plein air > Équipement sportif","parent_id":"19"}]};

const AMAZON_TAXONOMY = {"version":"2024","categories":[{"browse_node_id":"13921051","name":"High-Tech","path":"High-Tech","parent_id":null},{"browse_node_id":"340858031","name":"Informatique","path":"High-Tech > Informatique","parent_id":"13921051"},{"browse_node_id":"405689","name":"Smartphones","path":"High-Tech > Smartphones","parent_id":"13921051"},{"browse_node_id":"908826","name":"Audio et vidéo","path":"High-Tech > Audio et vidéo","parent_id":"13921051"},{"browse_node_id":"530490","name":"Livres","path":"Livres","parent_id":null},{"browse_node_id":"301061","name":"Vêtements","path":"Vêtements","parent_id":null},{"browse_node_id":"197858031","name":"Chaussures","path":"Vêtements > Chaussures","parent_id":"301061"},{"browse_node_id":"197649031","name":"Sacs","path":"Vêtements > Sacs","parent_id":"301061"},{"browse_node_id":"57686031","name":"Cuisine et Maison","path":"Cuisine et Maison","parent_id":null},{"browse_node_id":"3937551031","name":"Ustensiles de cuisine","path":"Cuisine et Maison > Ustensiles de cuisine","parent_id":"57686031"}]};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { analysis_id, preferred_model, web_search_enabled } = await req.json();
    
    console.log('[TAXONOMY] Preferred model:', preferred_model || 'auto');
    console.log('[TAXONOMY] Web search enabled:', web_search_enabled ?? false);

    const { data: settings } = await supabase
      .from('taxonomy_settings')
      .select('taxonomy_type')
      .eq('user_id', user.id)
      .maybeSingle();

    const taxonomyType = settings?.taxonomy_type || 'google';

    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Product analysis not found');
    }

    console.log('Using embedded taxonomy:', taxonomyType);
    const taxonomyData = taxonomyType === 'google' ? GOOGLE_TAXONOMY : AMAZON_TAXONOMY;

    const productInfo = {
      name: analysis.analysis_result?.product_name || analysis.analysis_result?.name,
      description: analysis.analysis_result?.description?.suggested_description,
      category: analysis.analysis_result?.category,
      brand: analysis.analysis_result?.brand,
      price: analysis.analysis_result?.price,
    };

    const categoriesText = taxonomyData.categories
      .map(cat => `ID: ${'id' in cat ? cat.id : cat.browse_node_id}, Path: ${cat.path}`)
      .join('\n');

    const prompt = `Tu es un expert en catégorisation e-commerce. Analyse ce produit et trouve la catégorie la plus appropriée dans la taxonomie ${taxonomyType === 'google' ? 'Google Shopping' : 'Amazon'}.

Produit:
- Nom: ${productInfo.name}
- Description: ${productInfo.description || 'N/A'}
- Catégorie actuelle: ${productInfo.category || 'N/A'}
- Marque: ${productInfo.brand || 'N/A'}
- Prix: ${productInfo.price || 'N/A'}

Catégories disponibles:
${categoriesText}

Réponds uniquement avec un JSON suivant ce format exact:
{
  "category_id": "l'ID de la catégorie la plus appropriée",
  "category_path": "le chemin complet de la catégorie",
  "confidence_score": score entre 0 et 1
}`;

    // Use shared AI fallback - skip Lovable AI to avoid 429s
    console.log('[TAXONOMY] Calling AI with fallback (skipping Lovable AI)');
    
    const aiResponse = await callAIWithFallback({
      model: preferred_model || 'gpt-oss:20b-cloud',
      messages: [{ role: 'user', content: prompt }],
      web_search: web_search_enabled ?? false
    }, ['lovable_ai']); // Skip Lovable AI to avoid rate limits

    if (!aiResponse.success) {
      console.error('[TAXONOMY] ❌ All providers failed:', aiResponse.errorCode);
      return new Response(
        JSON.stringify({ 
          success: false,
          code: aiResponse.errorCode || 'PROVIDER_DOWN',
          http_status: 503,
          message: 'Tous les providers IA sont indisponibles. Veuillez réessayer plus tard.',
          provider: aiResponse.provider,
          details: aiResponse.error
        }),
        { 
          status: 200, // Normalize to 200 for structured errors
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[TAXONOMY] ✅ Success with provider: ${aiResponse.provider || 'unknown'}`);
    
    const aiContent = aiResponse.content || '';
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!result || !result.category_id) {
      console.error('[TAXONOMY] Invalid AI response - missing category_id:', result);
      throw new Error('Invalid AI response: category_id missing');
    }

    console.log(`[TAXONOMY] Inserting primary taxonomy: ${taxonomyType}, category_id: ${result.category_id}`);
    
    // Use upsert to handle duplicate entries gracefully
    await supabase.from('product_taxonomy_mappings').upsert({
      analysis_id,
      taxonomy_type: taxonomyType,
      category_id: result.category_id,
      category_path: result.category_path,
      confidence_score: result.confidence_score,
    }, {
      onConflict: 'analysis_id,taxonomy_type'
    });

    // Also categorize with the other taxonomy (only if primary succeeded)
    const otherTaxonomyType = taxonomyType === 'google' ? 'amazon' : 'google';
    const otherTaxonomyData = otherTaxonomyType === 'google' ? GOOGLE_TAXONOMY : AMAZON_TAXONOMY;
    
    const otherCategoriesText = otherTaxonomyData.categories
      .map(cat => `ID: ${'id' in cat ? cat.id : cat.browse_node_id}, Path: ${cat.path}`)
      .join('\n');

    const otherPrompt = `${prompt.split('Catégories disponibles:')[0]}Catégories disponibles:\n${otherCategoriesText}`;

    // Try secondary taxonomy (best effort, don't fail if it errors)
    try {
      console.log('[TAXONOMY] Attempting secondary taxonomy...');
      const secondaryAiResponse = await callAIWithFallback({
        model: preferred_model || 'gpt-oss:20b-cloud',
        messages: [{ role: 'user', content: otherPrompt }],
        web_search: web_search_enabled ?? false
      }, ['lovable_ai']); // Skip Lovable AI

      if (secondaryAiResponse.success) {
        const secondaryContent = secondaryAiResponse.content || '';
        const secondaryMatch = secondaryContent.match(/\{[\s\S]*\}/);
        const secondaryResult = secondaryMatch ? JSON.parse(secondaryMatch[0]) : null;

        if (secondaryResult?.category_id) {
          await supabase.from('product_taxonomy_mappings').upsert({
            analysis_id,
            taxonomy_type: otherTaxonomyType,
            category_id: secondaryResult.category_id,
            category_path: secondaryResult.category_path,
            confidence_score: secondaryResult.confidence_score,
          }, { onConflict: 'analysis_id,taxonomy_type' });
          console.log(`[TAXONOMY] ✅ Secondary taxonomy added`);
        }
      }
    } catch (err) {
      console.warn('[TAXONOMY] Secondary taxonomy failed (non-critical):', err);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TAXONOMY] Critical error:', error);
    
    // Normalize error response to 200 with structured payload
    return new Response(
      JSON.stringify({ 
        success: false,
        code: 'INTERNAL_ERROR',
        http_status: 500,
        message: error.message || 'Erreur lors de la catégorisation',
        details: error.toString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
