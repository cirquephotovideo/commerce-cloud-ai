import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { handleError } from '../_shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


function detectInputType(input: string): 'url' | 'barcode' | 'product_name' {
  if (input.match(/^https?:\/\//i)) {
    return 'url';
  }
  
  if (input.match(/^\d{8,13}$/)) {
    return 'barcode';
  }
  
  return 'product_name';
}

const analysisPrompt = (productInfo: string, inputType: string, categories: any[], additionalData?: any) => {
  const categoriesContext = categories.length > 0
    ? `\n\nCatégories Odoo disponibles:\n${categories.map(c => `- ${c.full_path} (ID: ${c.odoo_category_id})`).join('\n')}`
    : '';

  const additionalContext = additionalData 
    ? `\n\nDonnées fournisseur existantes:
       - Description: ${additionalData.description || 'N/A'}
       - EAN: ${additionalData.ean || 'N/A'}
       - Marque: ${additionalData.brand || 'N/A'}
       - Catégorie: ${additionalData.category || 'N/A'}
       - Prix d'achat: ${additionalData.purchase_price || 'N/A'} ${additionalData.currency || ''}
       - Référence fournisseur: ${additionalData.supplier_reference || 'N/A'}`
    : '';

  return `Analyse complète du produit e-commerce en utilisant la recherche web pour obtenir des informations à jour.

Type d'entrée: ${inputType}
${inputType === 'url' ? `URL du produit: ${productInfo}` : 
  inputType === 'barcode' ? `Code-barres: ${productInfo}` : 
  `Nom du produit: ${productInfo}`}
${additionalContext}
${categoriesContext}

IMPORTANT: 
- Retourne UNIQUEMENT le JSON, sans texte markdown, sans balises de code
- Sois concis: description_long max 200 mots, recommendations max 2 par section
- Si tu manques d'info, utilise "N/A" ou null
- STRUCTURE EXACTE requise (JSON valide):

{
  "product_name": "Nom du produit identifié",
  "description": "description courte (50 caractères max)",
  "description_long": "description marketing longue et optimisée SEO (200-300 mots) mettant en valeur les bénéfices, caractéristiques et avantages du produit. Cette description doit être persuasive et inclure les principaux mots-clés du produit.",
  "seo": {
    "score": 85,
    "title": "Recommandation pour le titre SEO",
    "meta_description": "Recommandation pour la meta description",
    "keywords": ["mot-clé1", "mot-clé2", "mot-clé3"],
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "pricing": {
    "estimated_price": "Prix estimé du produit",
    "market_position": "Budget/Milieu de gamme/Premium",
    "competitive_analysis": "Analyse du positionnement tarifaire",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "competition": {
    "main_competitors": ["Concurrent 1", "Concurrent 2", "Concurrent 3"],
    "market_share": "Estimation de la part de marché",
    "differentiation": "Points de différenciation",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "competitive_pros": ["avantage concurrentiel 1", "avantage 2", "avantage 3"],
  "competitive_cons": ["inconvénient potentiel 1", "inconvénient 2"],
  "use_cases": ["cas d'utilisation professionnel 1", "cas d'utilisation particulier 2", "cas d'utilisation 3"],
  "market_position": "leader/challenger/niche - Explication du positionnement",
  "trends": {
    "market_trend": "Croissance/Stable/Déclin",
    "popularity_score": 75,
    "seasonal_factors": "Facteurs de saisonnalité",
    "future_outlook": "Perspectives d'avenir",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "description": {
    "current_quality": "Évaluation de la description actuelle",
    "suggested_description": "Proposition de description optimisée (2-3 paragraphes)",
    "key_features": ["Caractéristique 1", "Caractéristique 2", "Caractéristique 3"],
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "repairability": {
    "score": 7.5,
    "ease_of_repair": "facile/moyen/difficile",
    "spare_parts_availability": "excellente/bonne/moyenne/limitée",
    "durability_score": 8.0,
    "repairability_index": "8.5/10",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "hs_code": {
    "code": "854230",
    "description": "Description de la catégorie douanière",
    "tariff_info": "Informations sur les droits de douane applicables"
  },
  "environmental_impact": {
    "carbon_footprint": "Estimation des émissions CO2",
    "recyclability_score": 7.5,
    "eco_certifications": ["Energy Star", "EPEAT Gold"],
    "energy_efficiency": "A++",
    "eco_score": 8.0,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "image_optimization": {
    "quality_score": 80,
    "suggested_angles": ["Angle 1", "Angle 2", "Angle 3"],
    "background_recommendations": "Recommandations pour le fond (couleurs, style, mise en scène)",
    "lighting_suggestions": "Conseils d'éclairage (naturel, studio, diffus, etc.)",
    "composition_tips": "Conseils de composition (règle des tiers, point de vue, etc.)",
    "recommended_colors": ["#FF5733", "#33FF57", "#3357FF"],
    "photography_style": "Style de photographie recommandé (lifestyle, packshot, ambiance, etc.)",
    "technical_specs": {
      "min_resolution": "1200x1200px",
      "recommended_format": "PNG ou JPEG",
      "compression_level": "80-90%"
    },
    "ai_generation_prompts": [
      "Prompt 1 pour générer une image d'exemple avec IA",
      "Prompt 2 pour générer une image d'exemple avec IA"
    ],
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "tags_categories": {
    "primary_category": "Catégorie principale",
    "subcategories": ["Sous-catégorie 1", "Sous-catégorie 2"],
    "suggested_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "odoo_category_id": null,
    "odoo_category_name": "Si les catégories Odoo sont disponibles, choisis la catégorie la plus appropriée et indique son ID et nom complet, sinon null",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "customer_reviews": {
    "sentiment_score": 4.2,
    "common_praises": ["Point positif 1", "Point positif 2"],
    "common_complaints": ["Point négatif 1", "Point négatif 2"],
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "global_report": {
    "overall_score": 82,
    "strengths": ["Force 1", "Force 2", "Force 3"],
    "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
    "priority_actions": ["Action prioritaire 1", "Action prioritaire 2", "Action prioritaire 3"],
    "estimated_optimization_impact": "Impact estimé de l'optimisation"
  }
}

IMPORTANT: Retourne UNIQUEMENT le JSON, sans texte markdown, sans balises de code, juste l'objet JSON pur.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    let productInput: string;
    let additionalData: any = {};
    let includeImages = true;
    const preferredModel = body.preferred_model;

    if (typeof body === 'string') {
      productInput = body;
    } else if (body.url) {
      productInput = body.url;
      includeImages = true;
    } else if (body.productInput) {
      productInput = body.productInput;
      additionalData = body.additionalData || {};
      includeImages = body.includeImages !== false;
    } else if (body.name) {
      productInput = body.name;
      additionalData = body;
    } else {
      throw new Error('Missing productInput, name, url, or structured data');
    }

    console.log('[PRODUCT-ANALYZER] Request validated:', {
      productInput,
      inputType: detectInputType(productInput),
      includeImages,
      hasAdditionalData: Object.keys(additionalData).length > 0,
      timestamp: new Date().toISOString()
    });
    
    if (body.testMode) {
      console.log('[PRODUCT-ANALYZER] Test mode - returning mock analysis');
      return new Response(
        JSON.stringify({
          product_name: 'Test Product',
          category: 'Electronics',
          price: 999.99,
          seo_title: 'Test Product - Mock Data',
          testMode: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId = null;
    let categories: any[] = [];

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id;

      if (userId) {
        const { data: categoriesData } = await supabaseClient
          .from('odoo_categories')
          .select('*')
          .eq('user_id', userId);
        
        categories = categoriesData || [];
        console.log(`[PRODUCT-ANALYZER] Found ${categories.length} Odoo categories for user`);
      }
    }

    const inputType = detectInputType(productInput);
    console.log('[PRODUCT-ANALYZER] Input type detected:', inputType);

    // Use shared AI fallback logic with Ollama native web search - skip Lovable AI to avoid 429s
    console.log('[PRODUCT-ANALYZER] Calling AI with Ollama native web search (skipping Lovable AI)');
    
    const aiResponse = await callAIWithFallback({
      model: preferredModel || 'gpt-oss:20b-cloud',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse e-commerce.

RÈGLES ABSOLUES - JSON STRICT RFC 8259:
1. Retourne UNIQUEMENT un objet JSON valide
2. TOUS les strings DOIVENT être entre guillemets doubles "..."
3. ÉCHAPPE les guillemets internes avec \\"
4. ÉCHAPPE les retours à la ligne avec \\n
5. FERME TOUS les guillemets, accolades, crochets
6. PAS de virgule après le dernier élément d'un objet/array
7. PAS de texte markdown (pas de \`\`\`json), commentaires, ou explications
8. Le JSON DOIT commencer par { et finir par }

VALIDATION CRITIQUE:
- Vérifie que chaque " ouvert est fermé
- Vérifie que chaque { a son }
- Vérifie que chaque [ a son ]
- Si une description est trop longue, COUPE-LA à 500 caractères et ajoute "..." plutôt que de casser le JSON

Exemple de string valide avec retours à la ligne:
"description": "Produit de haute qualité\\navec garantie\\n\\nCaractéristiques:\\n- Point 1\\n- Point 2"

TOUS les champs manquants doivent avoir "N/A" ou [] ou {} selon le type attendu, mais retourne TOUJOURS un JSON valide et complet.`
        },
        {
          role: 'user',
          content: analysisPrompt(productInput, inputType, categories, additionalData)
        }
      ],
      web_search: true, // Enable Ollama native web search
    }, ['lovable_ai']); // Skip Lovable AI to avoid 429 rate limits

    if (!aiResponse.success) {
      console.error('[PRODUCT-ANALYZER] ❌ All providers failed:', aiResponse.errorCode);
      // Return 200 with structured error for better client UX
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Normalize to 200 for structured errors
        }
      );
    }

    console.log(`[PRODUCT-ANALYZER] ✅ Analysis completed with provider: ${aiResponse.provider || 'unknown'}`);
    console.log(`[PRODUCT-ANALYZER] Model used: ${preferredModel || 'default'}`);
    
    // Fonction de réparation JSON stricte
    const repairJSON = (content: string): string => {
      let repaired = content.trim();
      
      // 1. Retirer markdown
      repaired = repaired.replace(/```json/g, '').replace(/```/g, '');
      
      // 2. Échapper les nouvelles lignes dans les strings
      repaired = repaired.replace(/\n/g, ' ');
      
      // 3. Fermer le dernier string si non fermé
      const quotes = repaired.split('"').length - 1;
      if (quotes % 2 !== 0) {
        repaired += '"';
      }
      
      // 4. Compléter les accolades manquantes
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces);
      }
      
      return repaired;
    };
    
    let analysisContent = aiResponse.content.trim();
    
    // Phase 3: Improved JSON extraction for complex objects and arrays
    const extractField = (content: string, field: string): any => {
      // Try to extract objects, arrays, or strings
      const objectRegex = new RegExp(`"${field}"\\s*:\\s*(\\{[^}]+\\}|\\[[^\\]]+\\]|"[^"]*")`, 'gi');
      const match = content.match(objectRegex);
      if (match) {
        try {
          const value = match[0].split(':')[1].trim();
          return JSON.parse(value);
        } catch {
          return match[0].split(':')[1].replace(/"/g, '').trim();
        }
      }
      return null;
    };

    // Enhanced validation helper
    const validateAnalysisCompleteness = (analysis: any): { incomplete: boolean; missingFields: string[] } => {
      const requiredFields = [
        { path: 'product_name', check: (v: any) => v && typeof v === 'string' && v.length > 0 },
        { path: 'seo.score', check: (v: any) => typeof v === 'number' },
        { path: 'seo.keywords', check: (v: any) => Array.isArray(v) && v.length > 0 },
        { path: 'pricing.estimated_price', check: (v: any) => v && v !== 'N/A' },
        { path: 'global_report.overall_score', check: (v: any) => typeof v === 'number' },
        { path: 'description', check: (v: any) => v && v !== 'N/A' },
        { path: 'description_long', check: (v: any) => v && v.length > 50 }
      ];
      
      const missing: string[] = [];
      for (const field of requiredFields) {
        const value = field.path.split('.').reduce((obj, key) => obj?.[key], analysis);
        if (!field.check(value)) {
          missing.push(field.path);
        }
      }
      
      return {
        incomplete: missing.length > 0,
        missingFields: missing
      };
    };

    let analysisResult;
    let isPartialParse = false;
    
    try {
      const repairedContent = repairJSON(analysisContent);
      analysisResult = JSON.parse(repairedContent);
      
      console.log('[PRODUCT-ANALYZER] ✅ JSON parsed successfully on first attempt');
      console.log('[PRODUCT-ANALYZER] 🔍 Parsed analysis structure:', {
        has_product_name: !!analysisResult.product_name,
        has_images: !!analysisResult.images,
        has_description: !!analysisResult.description,
        has_description_long: !!analysisResult.description_long,
        top_level_keys: Object.keys(analysisResult).slice(0, 10)
      });
    } catch (parseError) {
      console.error('[PRODUCT-ANALYZER] ❌ JSON parse failed after repair, attempting cleanup...', parseError);
      isPartialParse = true;
      
      // Try to extract JSON from the response
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const repairedMatch = repairJSON(jsonMatch[0]);
          analysisResult = JSON.parse(repairedMatch);
          console.log('[PRODUCT-ANALYZER] ✅ Successfully parsed extracted JSON');
        } catch (secondError) {
          console.error('[PRODUCT-ANALYZER] ❌ Second parse failed, extracting partial data');
          
          // Phase 3: Better fallback extraction
          analysisResult = {
            product_name: extractField(analysisContent, 'product_name') || productInput,
            description: extractField(analysisContent, 'description') || 'N/A',
            description_long: extractField(analysisContent, 'description_long') || extractField(analysisContent, 'description') || 'Description non disponible',
            images: extractField(analysisContent, 'images') || [],
            seo: {
              score: 50,
              keywords: extractField(analysisContent, 'keywords') || []
            },
            pricing: {
              estimated_price: extractField(analysisContent, 'estimated_price') || 'N/A'
            },
            global_report: {
              overall_score: 50
            },
            raw_analysis: analysisContent,
            parsing_error: true
          };
          
          console.log('[PRODUCT-ANALYZER] 🔍 Fallback extraction result:', {
            product_name: analysisResult.product_name,
            has_description: !!analysisResult.description,
            has_images: Array.isArray(analysisResult.images) && analysisResult.images.length > 0
          });
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    }
    
    // Validate completeness
    const validation = validateAnalysisCompleteness(analysisResult);
    if (validation.incomplete || isPartialParse) {
      analysisResult._incomplete = true;
      analysisResult._missing_fields = validation.missingFields;
      analysisResult._needs_reanalysis = true;
      console.warn('[PRODUCT-ANALYZER] ⚠️ Analysis incomplete:', {
        missing_fields: validation.missingFields,
        partial_parse: isPartialParse
      });
    }

    // Fetch product images if requested
    let imageUrls: string[] = [];
    if (includeImages) {
      try {
        const productName = analysisResult.product_name || productInput;
        console.log(`[PRODUCT-ANALYZER] 📸 Fetching images for: "${productName}"`);
        
        const { data: imageData, error: imageError } = await supabaseClient.functions.invoke('search-product-images', {
          body: { productName }
        });

        console.log('[PRODUCT-ANALYZER] Image search response:', {
          hasError: !!imageError,
          error: imageError,
          dataKeys: imageData ? Object.keys(imageData) : [],
          imageCount: imageData?.images?.length || 0,
          source: imageData?.source
        });

        if (!imageError && imageData?.images) {
          imageUrls = imageData.images.map((img: any) => img.url);
          console.log(`[PRODUCT-ANALYZER] ✅ Found ${imageUrls.length} images from ${imageData.source}`);
        } else if (imageError) {
          console.error('[PRODUCT-ANALYZER] ❌ Image search error:', imageError);
        }
      } catch (imageError) {
        console.error('[PRODUCT-ANALYZER] ❌ Image search exception:', imageError);
      }
    } else {
      console.log('[PRODUCT-ANALYZER] ⏭️ Image search skipped (includeImages = false)');
    }

    // Phase 1: Flatten structure - return data directly, not wrapped in "analysis"
    const responseData = {
      ...analysisResult,
      imageUrls,
      usedProvider: aiResponse.provider,
      _provider: aiResponse.provider,
      _model: preferredModel || 'default',
      _timestamp: new Date().toISOString(),
      metadata: {
        inputType,
        hasWebSearch: true, // Ollama native web search enabled
        hasCategories: categories.length > 0,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('[PRODUCT-ANALYZER] 🔍 Final response structure:', {
      has_product_name: !!responseData.product_name,
      has_images: !!responseData.imageUrls,
      has_description_long: !!responseData.description_long,
      provider: responseData._provider
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: responseData,
        provider: aiResponse.provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PRODUCT-ANALYZER] Critical error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Normalize error response to 200 with structured payload
    return new Response(
      JSON.stringify({
        success: false,
        code: 'ANALYSIS_FAILED',
        http_status: 500,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'analyse du produit',
        details: {
          timestamp: new Date().toISOString(),
          context: 'product-analyzer'
        }
      }),
      { 
        status: 200, // Return 200 to avoid "non-2xx" errors in UI
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});