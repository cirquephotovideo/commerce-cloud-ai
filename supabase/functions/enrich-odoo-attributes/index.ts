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
    const { analysisId, provider = 'lovable', webSearchEnabled = true } = await req.json();
    
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

    // 2. Détecter la catégorie du produit
    // Extraire le nom du produit de manière robuste
    const productNameForDetection = analysis.supplier_products?.product_name 
      || analysis.analysis_result?.title 
      || analysis.analysis_result?.name 
      || analysis.product_url
      || '';
    
    // Extraire la description complète (suggested_description + key_features)
    let productDescForDetection = '';
    const analysisDesc = analysis.analysis_result?.description;
    if (analysisDesc && typeof analysisDesc === 'object') {
      productDescForDetection = [
        analysisDesc.suggested_description || '',
        Array.isArray(analysisDesc.key_features) ? analysisDesc.key_features.join(' ') : ''
      ].filter(Boolean).join(' ');
    } else {
      productDescForDetection = String(analysisDesc || '');
    }

    console.log(`[enrich-odoo-attributes] Texte pour détection: "${(productNameForDetection + ' ' + productDescForDetection).slice(0, 200)}..."`);

    
    const { data: categories } = await supabase
      .from('product_categories')
      .select('*');

    let detectedCategory = 'non_categorise';
    let categoryDisplayName = 'Non catégorisé';
    
    if (categories && categories.length > 0) {
      const searchText = `${productNameForDetection} ${productDescForDetection}`.toLowerCase();
      
      for (const cat of categories) {
        const keywords = cat.detection_keywords || [];
        if (keywords.some((kw: string) => searchText.includes(kw.toLowerCase()))) {
          detectedCategory = cat.attribute_category;
          categoryDisplayName = cat.display_name;
          break;
        }
      }
    }

    console.log(`[enrich-odoo-attributes] Catégorie détectée: ${detectedCategory} (${categoryDisplayName})`);

    // 3. Récupérer le référentiel d'attributs pour cette catégorie
    const { data: attributeDefinitions, error: attrError } = await supabase
      .from('product_attribute_definitions')
      .select('*')
      .eq('category', detectedCategory);

    if (attrError) {
      console.error('[enrich-odoo-attributes] Erreur fetch attributs:', attrError);
      throw attrError;
    }

    if (!attributeDefinitions || attributeDefinitions.length === 0) {
      console.warn(`[enrich-odoo-attributes] Aucun attribut trouvé pour la catégorie "${detectedCategory}"`);
      return new Response(
        JSON.stringify({ 
          error: `Aucun référentiel d'attributs pour la catégorie "${categoryDisplayName}"`,
          category: detectedCategory,
          categoryDisplayName
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Grouper les attributs par nom
    const attributeSchema: Record<string, string[]> = {};
    for (const attr of attributeDefinitions || []) {
      if (!attributeSchema[attr.attribute_name]) {
        attributeSchema[attr.attribute_name] = [];
      }
      if (!attributeSchema[attr.attribute_name].includes(attr.attribute_value)) {
        attributeSchema[attr.attribute_name].push(attr.attribute_value);
      }
    }

    console.log(`[enrich-odoo-attributes] ${Object.keys(attributeSchema).length} types d'attributs trouvés pour "${categoryDisplayName}"`);

    // 5. Préparer le contexte produit (avec fallback intelligent)
    const product = analysis.supplier_products;
    
    // Stratégie de fallback intelligente
    const productName = product?.product_name 
      || analysis.analysis_result?.title 
      || analysis.analysis_result?.name
      || analysis.product_url
      || 'Produit inconnu';

    // Parser la description si c'est un objet JSON
    let productDescription = product?.description || '';
    if (!productDescription && analysis.analysis_result?.description) {
      const desc = analysis.analysis_result.description;
      if (typeof desc === 'object') {
        // Extraire suggested_description ou key_features
        productDescription = desc.suggested_description 
          || (desc.key_features ? desc.key_features.join(' • ') : '') 
          || JSON.stringify(desc);
      } else {
        productDescription = String(desc);
      }
    }

    // Extraire le brand depuis key_features ou suggested_description
    let productBrand = analysis.analysis_result?.brand || product?.additional_data?.brand || '';
    if (!productBrand && productDescription) {
      // Essayer de détecter la marque dans la description
      const brandPatterns = [
        { pattern: /iPhone|iPad|MacBook/i, brand: 'Apple' },
        { pattern: /Galaxy|Samsung/i, brand: 'Samsung' },
        { pattern: /Pixel/i, brand: 'Google' },
        { pattern: /ThinkPad|Lenovo/i, brand: 'Lenovo' },
        { pattern: /Surface/i, brand: 'Microsoft' },
        { pattern: /Dell/i, brand: 'Dell' },
        { pattern: /HP|Hewlett/i, brand: 'HP' },
      ];
      for (const { pattern, brand } of brandPatterns) {
        if (pattern.test(productDescription) || pattern.test(productName)) {
          productBrand = brand;
          break;
        }
      }
    }

    // Extraire les specs depuis key_features
    let productSpecs = product?.additional_data?.specs 
      || analysis.analysis_result?.specifications 
      || [];
    if (productSpecs.length === 0 && analysis.analysis_result?.description?.key_features) {
      productSpecs = analysis.analysis_result.description.key_features;
    }

    const productContext = `
RÉFÉRENCE: ${product?.supplier_reference || 'N/A'}
MARQUE: ${productBrand || 'Marque inconnue'}
NOM: ${productName}
DESCRIPTION: ${productDescription}
URL: ${analysis.product_url || 'N/A'}
DIMENSIONS: ${product?.additional_data?.dimensions || 'N/A'}
PRIX: ${product?.purchase_price || 'N/A'} EUR
SPÉCIFICATIONS: ${JSON.stringify(productSpecs)}
`;

    console.log('[enrich-odoo-attributes] Contexte produit:', productContext.slice(0, 500) + '...');

    // 5.5 Enrichir avec Amazon MCP si EAN disponible
    let amazonContext = '';
    if (analysis.ean) {
      try {
        console.log(`[enrich-odoo-attributes] Tentative enrichissement Amazon MCP pour EAN: ${analysis.ean}`);
        
        const { data: amazonMCP, error: amazonError } = await supabaseClient.functions.invoke('mcp-proxy', {
          body: {
            packageId: 'amazon-seller-mcp',
            toolName: 'search_catalog',
            args: { keywords: analysis.ean }
          }
        });
        
        if (!amazonError && amazonMCP?.success && amazonMCP?.data?.items?.[0]) {
          const amazonProduct = amazonMCP.data.items[0];
          amazonContext = `\n\nDONNÉES AMAZON:
- ASIN: ${amazonProduct.asin}
- Titre: ${amazonProduct.summaries?.[0]?.itemName || 'N/A'}
- Marque: ${amazonProduct.summaries?.[0]?.brand || 'N/A'}
- Prix: ${amazonProduct.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.amount || 'N/A'} ${amazonProduct.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.currencyCode || ''}
- Catégorie: ${amazonProduct.productTypes?.[0] || 'N/A'}
- Sales Rank: ${amazonProduct.salesRanks?.[0]?.rank || 'N/A'}`;
          console.log('[enrich-odoo-attributes] Données Amazon récupérées avec succès');
        } else {
          console.warn('[enrich-odoo-attributes] Amazon MCP: aucun résultat ou erreur', amazonError);
        }
      } catch (e) {
        console.warn('[enrich-odoo-attributes] Amazon MCP non disponible:', e);
      }
    }

    // 6. Web search si activé
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

    // 7. Construire le prompt IA
    const systemPrompt = `Tu es un expert en classification de produits pour Odoo.

Voici les définitions d'attributs Odoo pour la catégorie ${categoryDisplayName.toUpperCase()} :

${JSON.stringify(attributeSchema, null, 2)}

PRODUIT À ANALYSER :

${productContext}
${amazonContext}
${webContext}

RÈGLES STRICTES - AUCUNE HALLUCINATION TOLÉRÉE :
1. Tu DOIS choisir UNIQUEMENT des valeurs présentes dans le référentiel fourni ci-dessus
2. Si une valeur n'existe pas exactement, choisis la valeur la plus proche sémantiquement parmi celles du référentiel
3. Si tu ne peux absolument pas déterminer un attribut avec certitude, mets "Non déterminé"
4. NE GÉNÈRE AUCUN ATTRIBUT qui n'est pas dans le référentiel fourni
5. Si le référentiel est vide pour un attribut, retourne "Non déterminé" pour cet attribut
6. Traite TOUS les attributs du référentiel, ne saute aucun attribut
7. Sois cohérent avec les dimensions et spécifications du produit
8. INTERDIT d'inventer des valeurs qui ne sont pas explicitement listées dans le référentiel

Réponds UNIQUEMENT avec un JSON valide contenant TOUS les attributs du référentiel.`;

    console.log('[enrich-odoo-attributes] Appel IA avec fallback automatique...');

    // 8. Appel IA avec fallback automatique (Ollama prioritaire)
    const { callAIWithFallback } = await import('../_shared/ai-fallback.ts');

    const fallbackResponse = await callAIWithFallback({
      model: 'gpt-oss:120b-cloud',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui répond UNIQUEMENT en JSON valide.' },
        { role: 'user', content: systemPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    if (!fallbackResponse.success) {
      throw new Error(`Tous les providers IA ont échoué: ${fallbackResponse.error}`);
    }

    console.log(`[enrich-odoo-attributes] ✅ Réponse IA reçue via provider: ${fallbackResponse.provider}`);
    
    const aiData = fallbackResponse.content;
    console.log('[enrich-odoo-attributes] Réponse IA reçue');

    // 9. Parser la réponse JSON
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

    // 10. Validation stricte des valeurs
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

    // 11. Sauvegarder dans product_analyses
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({ 
        odoo_attributes: validatedAttributes,
        category: detectedCategory,
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
        category: detectedCategory,
        categoryDisplayName,
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
