import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { analysis_id } = await req.json();

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
      .map(cat => `ID: ${taxonomyType === 'google' ? cat.id : cat.browse_node_id}, Path: ${cat.path}`)
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

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0]?.message?.content || '';
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!result) throw new Error('Invalid AI response');

    await supabase.from('product_taxonomy_mappings').insert({
      analysis_id,
      taxonomy_type: taxonomyType,
      category_id: result.category_id,
      category_path: result.category_path,
      confidence_score: result.confidence_score,
    });

    // Also categorize with the other taxonomy
    const otherTaxonomyType = taxonomyType === 'google' ? 'amazon' : 'google';
    const otherTaxonomyData = otherTaxonomyType === 'google' ? GOOGLE_TAXONOMY : AMAZON_TAXONOMY;
    
    const otherCategoriesText = otherTaxonomyData.categories
      .map(cat => `ID: ${otherTaxonomyType === 'google' ? cat.id : cat.browse_node_id}, Path: ${cat.path}`)
      .join('\n');

    const otherPrompt = `${prompt.split('Catégories disponibles:')[0]}Catégories disponibles:\n${otherCategoriesText}`;

    const otherAiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: otherPrompt }],
        temperature: 0.3,
      }),
    });

    if (otherAiResponse.ok) {
      const otherAiData = await otherAiResponse.json();
      const otherAiContent = otherAiData.choices[0]?.message?.content || '';
      const otherJsonMatch = otherAiContent.match(/\{[\s\S]*\}/);
      const otherResult = otherJsonMatch ? JSON.parse(otherJsonMatch[0]) : null;

      if (otherResult) {
        await supabase.from('product_taxonomy_mappings').insert({
          analysis_id,
          taxonomy_type: otherTaxonomyType,
          category_id: otherResult.category_id,
          category_path: otherResult.category_path,
          confidence_score: otherResult.confidence_score,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Taxonomy categorization error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
