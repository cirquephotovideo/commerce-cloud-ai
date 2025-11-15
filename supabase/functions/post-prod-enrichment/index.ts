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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysis_id, missing_fields, target_platform = 'odoo' } = await req.json();

    console.log(`[POST-PROD ENRICHMENT] Démarrage pour ${analysis_id}, plateforme: ${target_platform}`);

    // Récupérer les données produit
    const { data: analysis } = await supabaseClient
      .from('product_analyses')
      .select('*, specifications, long_description, analysis_result')
      .eq('id', analysis_id)
      .single();

    if (!analysis) {
      throw new Error('Product analysis not found');
    }

    const productName = analysis.name || 'Produit';
    const productBrand = analysis.analysis_result?.brand || analysis.brand || '';
    const productEan = analysis.ean || '';

    const enrichmentResults = {
      description_completed: false,
      specifications_completed: false,
      hs_code_completed: false,
      odoo_category_completed: false
    };

    // 1. ENRICHIR DESCRIPTION LONGUE (si manquante)
    if (missing_fields.includes('description_longue')) {
      try {
        console.log(`[POST-PROD] Génération description pour ${productName}`);
        
        const descPrompt = `Génère une description produit e-commerce professionnelle optimisée SEO pour la plateforme ${target_platform}.

Produit: ${productName}
Marque: ${productBrand}
EAN: ${productEan}

Fais une recherche web pour trouver les caractéristiques précises du produit.

Format attendu pour ${target_platform}:
${target_platform === 'odoo' ? '- Structure HTML avec <p>, <ul>, <li>\n- Focus technique et professionnel\n- 300-500 mots' : ''}
${target_platform === 'shopify' ? '- Markdown simple\n- Langage marketing\n- 200-400 mots' : ''}
${target_platform === 'prestashop' ? '- HTML enrichi\n- Bullet points clairs\n- 250-450 mots' : ''}

Retourne UNIQUEMENT un JSON:
{
  "description_html": "<description complète>",
  "short_description": "<résumé 100 mots>",
  "seo_keywords": ["mot1", "mot2", "mot3"]
}`;

        const descResponse = await callOllamaWithWebSearch({
          model: 'qwen3-coder:480b-cloud',
          messages: [{ role: 'user', content: descPrompt }],
          temperature: 0.5,
          maxTokens: 2000
        });

        const descData = parseJSONFromText(descResponse.content);

        await supabaseClient
          .from('product_analyses')
          .update({
            long_description: descData.description_html,
            analysis_result: {
              ...analysis.analysis_result,
              short_description: descData.short_description,
              seo_keywords: descData.seo_keywords
            }
          })
          .eq('id', analysis_id);

        enrichmentResults.description_completed = true;
        console.log(`[POST-PROD] ✅ Description générée`);
      } catch (error) {
        console.error(`[POST-PROD] ❌ Erreur description:`, error);
      }
    }

    // 2. ENRICHIR SPECIFICATIONS TECHNIQUES (si manquantes)
    if (missing_fields.includes('specifications_techniques')) {
      try {
        console.log(`[POST-PROD] Génération specs pour ${productName}`);
        
        const specsPrompt = `Recherche sur le web les spécifications techniques détaillées de ce produit:

Produit: ${productName}
Marque: ${productBrand}
EAN: ${productEan}

Retourne UNIQUEMENT un JSON avec minimum 10 caractéristiques:
{
  "dimensions": "<dimensions en cm>",
  "poids": "<poids en kg>",
  "couleur": "<couleur>",
  "materiau": "<matériaux>",
  "garantie": "<durée garantie>",
  "origine": "<pays origine>",
  "certifications": ["cert1", "cert2"],
  "caracteristiques_supplementaires": {
    "spec1": "valeur1",
    "spec2": "valeur2"
  }
}`;

        const specsResponse = await callOllamaWithWebSearch({
          model: 'qwen3-coder:480b-cloud',
          messages: [{ role: 'user', content: specsPrompt }],
          temperature: 0.3,
          maxTokens: 1500
        });

        const specsData = parseJSONFromText(specsResponse.content);

        await supabaseClient
          .from('product_analyses')
          .update({ specifications: specsData })
          .eq('id', analysis_id);

        enrichmentResults.specifications_completed = true;
        console.log(`[POST-PROD] ✅ Spécifications générées`);
      } catch (error) {
        console.error(`[POST-PROD] ❌ Erreur specs:`, error);
      }
    }

    // 3. ENRICHIR CODE HS + CATEGORIE ODOO (si manquants)
    if (missing_fields.includes('code_hs') || missing_fields.includes('categorie_odoo')) {
      try {
        console.log(`[POST-PROD] Détermination code HS et catégorie pour ${productName}`);
        
        const hsPrompt = `Détermine le code HS (Harmonized System) et la catégorie Odoo e-commerce appropriée pour:

Produit: ${productName}
Marque: ${productBrand}
Catégorie: ${analysis.analysis_result?.category || 'Non spécifié'}

Fais une recherche web si nécessaire pour classifier correctement.

Retourne UNIQUEMENT un JSON:
{
  "hs_code": "<code HS 8-10 chiffres>",
  "hs_description": "<description HS>",
  "odoo_category": "<chemin complet catégorie Odoo, ex: Électronique/Audio/Casques>",
  "tax_rate": <taux TVA applicable en %>,
  "country_of_origin": "<pays d'origine probable>"
}`;

        const hsResponse = await callOllamaWithWebSearch({
          model: 'qwen3-coder:480b-cloud',
          messages: [{ role: 'user', content: hsPrompt }],
          temperature: 0.2,
          maxTokens: 800
        });

        const hsData = parseJSONFromText(hsResponse.content);

        // Vérifier si odoo_attributes existe déjà
        const { data: existingAttrs } = await supabaseClient
          .from('odoo_attributes')
          .select('id')
          .eq('analysis_id', analysis_id)
          .maybeSingle();

        if (existingAttrs) {
          await supabaseClient
            .from('odoo_attributes')
            .update({
              hs_code: hsData.hs_code,
              product_category: hsData.odoo_category,
              tax_rate: hsData.tax_rate
            })
            .eq('id', existingAttrs.id);
        } else {
          await supabaseClient
            .from('odoo_attributes')
            .insert({
              analysis_id,
              user_id: user.id,
              hs_code: hsData.hs_code,
              product_category: hsData.odoo_category,
              tax_rate: hsData.tax_rate
            });
        }

        enrichmentResults.hs_code_completed = true;
        enrichmentResults.odoo_category_completed = true;
        console.log(`[POST-PROD] ✅ Code HS et catégorie ajoutés`);
      } catch (error) {
        console.error(`[POST-PROD] ❌ Erreur HS/catégorie:`, error);
      }
    }

    // Revalider le produit
    await supabaseClient.functions.invoke('validate-pre-export', {
      body: { analysis_id }
    });

    const completedCount = Object.values(enrichmentResults).filter(v => v).length;
    const totalTasks = Object.keys(enrichmentResults).length;

    console.log(`[POST-PROD] ✅ Enrichissement terminé: ${completedCount}/${totalTasks} tâches complétées`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id,
        enrichment_results: enrichmentResults,
        completed_count: completedCount,
        total_tasks: totalTasks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[POST-PROD ENRICHMENT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
