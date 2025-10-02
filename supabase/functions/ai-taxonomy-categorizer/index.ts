import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get user's taxonomy preference
    const { data: settings } = await supabase
      .from('taxonomy_settings')
      .select('taxonomy_type')
      .eq('user_id', user.id)
      .maybeSingle();

    const taxonomyType = settings?.taxonomy_type || 'google';

    // Get product analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Product analysis not found');
    }

    // Load taxonomy file
    const taxonomyUrl = `${supabaseUrl.replace(/\/[^\/]+$/, '')}/taxonomies/${taxonomyType}-taxonomy-fr.json`;
    const taxonomyResponse = await fetch(taxonomyUrl);
    const taxonomyData = await taxonomyResponse.json();

    // Extract product info
    const productName = analysis.analysis_result?.name || '';
    const description = analysis.analysis_result?.description || '';
    const currentCategory = analysis.mapped_category_name || '';

    // Prepare taxonomy list for AI (limit to 50 most relevant categories)
    const categoryList = taxonomyData.categories
      .slice(0, 50)
      .map((cat: any) => `${cat.id}: ${cat.path}`)
      .join('\n');

    // Call AI for categorization
    const prompt = `Tu es un expert en catégorisation e-commerce. Catégorise ce produit dans la taxonomie ${taxonomyType === 'google' ? 'Google Shopping' : 'Amazon Browse Tree'}.

Produit:
- Nom: ${productName}
- Description: ${description}
${currentCategory ? `- Catégorie actuelle: ${currentCategory}` : ''}

Voici les principales catégories disponibles:
${categoryList}

Retourne UNIQUEMENT un objet JSON avec cette structure exacte (sans markdown):
{
  "primary_category": {
    "id": "ID_CATEGORIE",
    "path": "Chemin > Complet > Catégorie",
    "confidence": 0.95
  },
  "secondary_category": {
    "id": "ID_CATEGORIE_2",
    "path": "Chemin > Alternatif",
    "confidence": 0.75
  }
}

Si tu n'es pas sûr, mets un score de confiance plus bas. Le secondary_category est optionnel.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    // Parse AI response
    let categorization;
    try {
      // Remove markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      categorization = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid AI response format');
    }

    // Save both taxonomies
    const mappings = [];
    
    if (categorization.primary_category) {
      mappings.push({
        analysis_id,
        taxonomy_type: taxonomyType,
        category_id: categorization.primary_category.id,
        category_path: categorization.primary_category.path,
        confidence_score: categorization.primary_category.confidence * 100,
      });
    }

    // Also categorize with the other taxonomy for comparison
    const otherTaxonomyType = taxonomyType === 'google' ? 'amazon' : 'google';
    const otherTaxonomyUrl = `${supabaseUrl.replace(/\/[^\/]+$/, '')}/taxonomies/${otherTaxonomyType}-taxonomy-fr.json`;
    const otherTaxonomyResponse = await fetch(otherTaxonomyUrl);
    const otherTaxonomyData = await otherTaxonomyResponse.json();
    
    const otherCategoryList = otherTaxonomyData.categories
      .slice(0, 30)
      .map((cat: any) => `${cat.id || cat.browse_node_id}: ${cat.path}`)
      .join('\n');

    const otherPrompt = `Catégorise rapidement ce produit: "${productName}" dans ces catégories ${otherTaxonomyType}:
${otherCategoryList}

Retourne JSON: {"id": "...", "path": "...", "confidence": 0.8}`;

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
      const otherContent = otherAiData.choices?.[0]?.message?.content || '';
      try {
        const cleanOtherContent = otherContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const otherCategory = JSON.parse(cleanOtherContent);
        mappings.push({
          analysis_id,
          taxonomy_type: otherTaxonomyType,
          category_id: otherCategory.id || otherCategory.browse_node_id,
          category_path: otherCategory.path,
          confidence_score: (otherCategory.confidence || 0.7) * 100,
        });
      } catch (e) {
        console.error('Failed to parse other taxonomy:', e);
      }
    }

    // Delete existing mappings and insert new ones
    await supabase
      .from('product_taxonomy_mappings')
      .delete()
      .eq('analysis_id', analysis_id);

    const { error: insertError } = await supabase
      .from('product_taxonomy_mappings')
      .insert(mappings);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        categorization,
        mappings_created: mappings.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Taxonomy categorization error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
