import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, provider = 'lovable', webSearchEnabled = false } = await req.json();
    
    if (!analysisId) {
      throw new Error("analysisId est requis");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[enrich-odoo-attributes] Début enrichissement pour analyse: ${analysisId}`);

    // 1. Récupérer l'analyse produit
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*, supplier_products(*)')
      .eq('id', analysisId)
      .single();

    if (analysisError) {
      console.error('[enrich-odoo-attributes] Erreur fetch analyse:', analysisError);
      throw analysisError;
    }

    console.log(`[enrich-odoo-attributes] Produit: ${analysis.supplier_products?.product_name}`);

    // 2. Récupérer le référentiel d'attributs
    const { data: attributeDefinitions, error: attrError } = await supabase
      .from('product_attribute_definitions')
      .select('*')
      .eq('category', 'hottes');

    if (attrError) {
      console.error('[enrich-odoo-attributes] Erreur fetch attributs:', attrError);
      throw attrError;
    }

    // 3. Grouper les attributs par nom
    const attributeSchema: Record<string, string[]> = {};
    for (const attr of attributeDefinitions || []) {
      if (!attributeSchema[attr.attribute_name]) {
        attributeSchema[attr.attribute_name] = [];
      }
      if (!attributeSchema[attr.attribute_name].includes(attr.attribute_value)) {
        attributeSchema[attr.attribute_name].push(attr.attribute_value);
      }
    }

    console.log(`[enrich-odoo-attributes] ${Object.keys(attributeSchema).length} types d'attributs trouvés`);

    // 4. Préparer le contexte produit (avec fallback sur analysis_result)
    const product = analysis.supplier_products;
    
    // Stratégie de fallback : utiliser supplier_products SI disponible, sinon analysis_result
    const productName = product?.product_name 
      || analysis.analysis_result?.title 
      || analysis.analysis_result?.name
      || analysis.product_url;

    const productDescription = product?.description 
      || analysis.analysis_result?.description 
      || '';

    const productBrand = analysis.analysis_result?.brand 
      || product?.additional_data?.brand 
      || '';

    const productSpecs = product?.additional_data?.specs 
      || analysis.analysis_result?.specifications 
      || [];

    const productContext = `
RÉFÉRENCE: ${product?.supplier_reference || 'N/A'}
MARQUE: ${productBrand}
NOM: ${productName}
DESCRIPTION: ${productDescription}
URL: ${analysis.product_url || 'N/A'}
DIMENSIONS: ${product?.additional_data?.dimensions || 'N/A'}
PRIX: ${product?.purchase_price || 'N/A'} EUR
SPÉCIFICATIONS: ${JSON.stringify(productSpecs)}
`;

    // 5. Web search si activé
    let webContext = '';
    if (webSearchEnabled) {
      try {
        const searchQuery = `${analysis.analysis_result?.brand || ''} ${product.product_name} spécifications techniques`;
        console.log(`[enrich-odoo-attributes] Recherche web: ${searchQuery}`);
        
        const serperApiKey = Deno.env.get('SERPER_API_KEY');
        if (serperApiKey) {
          const serperResponse = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': serperApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: searchQuery,
              num: 3
            })
          });

          if (serperResponse.ok) {
            const serperData = await serperResponse.json();
            webContext = '\n\nINFORMATIONS WEB:\n' + 
              serperData.organic?.slice(0, 3).map((r: any) => 
                `${r.title}\n${r.snippet}`
              ).join('\n\n');
            console.log('[enrich-odoo-attributes] Web search réussie');
          }
        }
      } catch (error) {
        console.warn('[enrich-odoo-attributes] Erreur web search:', error);
      }
    }

    // 6. Construire le prompt IA
    const systemPrompt = `Tu es un expert en classification de produits électroménagers pour Odoo.
Ta mission : extraire TOUS les attributs Odoo d'un produit à partir de sa description.

RÈGLES STRICTES :
1. Tu DOIS choisir UNIQUEMENT des valeurs présentes dans le référentiel fourni
2. Si une valeur n'existe pas exactement, choisis la plus proche sémantiquement
3. Si tu ne peux absolument pas déterminer un attribut, mets "Non déterminé"
4. Traite TOUS les attributs du référentiel, ne saute aucun attribut
5. Sois cohérent avec les dimensions et spécifications du produit

RÉFÉRENTIEL D'ATTRIBUTS AUTORISÉS :
${JSON.stringify(attributeSchema, null, 2)}

PRODUIT À ANALYSER :
${productContext}
${webContext}

Réponds UNIQUEMENT avec un JSON valide contenant TOUS les attributs du référentiel.
Format exact :
{
  "Type de hotte": "valeur du référentiel",
  "Mode de fonctionnement": "valeur du référentiel",
  ...
}`;

    console.log('[enrich-odoo-attributes] Appel IA...');

    // 7. Appel IA selon le provider
    let aiResponse;
    
    if (provider === 'lovable' || provider === 'lovable-ai') {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableKey) {
        throw new Error('LOVABLE_API_KEY non configurée');
      }
      
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Tu es un assistant qui répond UNIQUEMENT en JSON valide.' },
            { role: 'user', content: systemPrompt }
          ],
          temperature: 0.3
        })
      });
    } else if (provider === 'ollama_cloud') {
      const ollamaKey = Deno.env.get('OLLAMA_API_KEY');
      if (!ollamaKey) {
        throw new Error('OLLAMA_API_KEY non configurée');
      }
      
      aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ollama-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'chat',
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Tu es un assistant qui répond UNIQUEMENT en JSON valide.' },
            { role: 'user', content: systemPrompt }
          ],
          temperature: 0.3
        })
      });
    } else {
      throw new Error(`Provider non supporté: ${provider}`);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[enrich-odoo-attributes] Erreur IA:', errorText);
      throw new Error(`Erreur IA: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('[enrich-odoo-attributes] Réponse IA reçue');

    // 8. Parser la réponse JSON
    let extractedAttributes: Record<string, string> = {};
    try {
      const responseText = aiData.choices?.[0]?.message?.content || aiData.response || '{}';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedAttributes = JSON.parse(jsonMatch[0]);
      } else {
        extractedAttributes = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('[enrich-odoo-attributes] Erreur parsing JSON:', parseError);
      throw new Error('Impossible de parser la réponse IA');
    }

    console.log(`[enrich-odoo-attributes] ${Object.keys(extractedAttributes).length} attributs extraits`);

    // 9. Validation stricte des valeurs
    const validatedAttributes: Record<string, string> = {};
    let validCount = 0;
    let invalidCount = 0;

    for (const [attrName, attrValue] of Object.entries(extractedAttributes)) {
      const allowedValues = attributeSchema[attrName];
      if (allowedValues && allowedValues.includes(attrValue)) {
        validatedAttributes[attrName] = attrValue;
        validCount++;
      } else {
        console.warn(`⚠️ Valeur invalide pour "${attrName}": "${attrValue}"`);
        validatedAttributes[attrName] = "Non déterminé";
        invalidCount++;
      }
    }

    console.log(`[enrich-odoo-attributes] Validation: ${validCount} valides, ${invalidCount} invalides`);

    // 10. Sauvegarder dans product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({ 
        odoo_attributes: validatedAttributes,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      console.error('[enrich-odoo-attributes] Erreur update:', updateError);
      throw updateError;
    }

    console.log('[enrich-odoo-attributes] Enrichissement terminé avec succès');

    return new Response(
      JSON.stringify({ 
        success: true,
        attributes: validatedAttributes,
        stats: {
          total: Object.keys(validatedAttributes).length,
          valid: validCount,
          invalid: invalidCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[enrich-odoo-attributes] Erreur globale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
