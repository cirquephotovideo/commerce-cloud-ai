import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { handleError } from '../_shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

async function searchWebWithOllama(query: string): Promise<SearchResult[]> {
  const OLLAMA_API_KEY = Deno.env.get('OLLAMA_API_KEY');
  if (!OLLAMA_API_KEY) {
    console.log('[WEB-SEARCH] No Ollama API key, skipping');
    return [];
  }

  try {
    console.log('[WEB-SEARCH] Trying Ollama Cloud...');
    const response = await fetch('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        max_results: 5
      })
    });

    if (!response.ok) {
      console.error(`[WEB-SEARCH] Ollama API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log('[WEB-SEARCH] ✅ Ollama Cloud success');
    
    return data.results?.map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.content || '',
    })) || [];
  } catch (error) {
    console.error('[WEB-SEARCH] Ollama error:', error);
    return [];
  }
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  // 1. Try Ollama Cloud Web Search (PRIORITY)
  const ollamaResults = await searchWebWithOllama(query);
  if (ollamaResults.length > 0) {
    return ollamaResults;
  }

  // 2. Try Serper API
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  if (SERPER_API_KEY) {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 5 })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[WEB-SEARCH] Serper API success');
        return data.organic?.slice(0, 5).map((r: any) => ({
          title: r.title,
          url: r.link,
          description: r.snippet,
        })) || [];
      }
    } catch (error) {
      console.error('[WEB-SEARCH] Serper API error:', error);
    }
  }
  
  // Fallback to Brave Search
  try {
    const BRAVE_API_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY');
    if (!BRAVE_API_KEY) {
      console.log('[WEB-SEARCH] No search API available, continuing without web search');
      return [];
    }
    
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });
    
    if (!response.ok) {
      console.log('[WEB-SEARCH] Brave API not available, continuing without web search');
      return [];
    }
    
    const data = await response.json();
    console.log('[WEB-SEARCH] Brave API success');
    return data.web?.results?.slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    })) || [];
  } catch (error) {
    console.log('[WEB-SEARCH] Error, continuing without web search:', error);
    return [];
  }
}

function detectInputType(input: string): 'url' | 'barcode' | 'product_name' {
  if (input.match(/^https?:\/\//i)) {
    return 'url';
  }
  
  if (input.match(/^\d{8,13}$/)) {
    return 'barcode';
  }
  
  return 'product_name';
}

const analysisPrompt = (productInfo: string, inputType: string, searchResults: SearchResult[], categories: any[], additionalData?: any) => {
  const searchContext = searchResults.length > 0 
    ? `\n\nInformations trouvées sur le web:\n${searchResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
    : '';

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

  return `Analyse complète du produit e-commerce.

Type d'entrée: ${inputType}
${inputType === 'url' ? `URL du produit: ${productInfo}` : 
  inputType === 'barcode' ? `Code-barres: ${productInfo}` : 
  `Nom du produit: ${productInfo}`}
${additionalContext}
${searchContext}
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

    let searchQuery = productInput;
    if (inputType === 'barcode') {
      searchQuery = `produit code-barres ${productInput} prix avis`;
    } else if (inputType === 'product_name') {
      searchQuery = `${productInput} acheter prix avis e-commerce`;
    }

    console.log('[PRODUCT-ANALYZER] Searching web for:', searchQuery);
    const searchResults = await searchWeb(searchQuery);
    console.log('[PRODUCT-ANALYZER] Found', searchResults.length, 'search results');

    // Use shared AI fallback logic
    console.log('[PRODUCT-ANALYZER] Calling AI with automatic fallback (Ollama → Lovable AI → OpenAI → OpenRouter)');
    
    const aiResponse = await callAIWithFallback({
      model: preferredModel || 'gpt-oss:120b-cloud',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse e-commerce.

RÈGLES ABSOLUES:
1. Tu dois retourner UNIQUEMENT un objet JSON valide
2. PAS de texte markdown (pas de \`\`\`json)
3. PAS de balises de code
4. PAS d'explications avant ou après
5. UNIQUEMENT le JSON pur qui commence par { et se termine par }
6. Le JSON DOIT être complet et valide
7. TOUS les champs requis doivent être présents

Si tu ne peux pas analyser complètement, remplis les champs manquants avec "N/A" ou des valeurs par défaut, mais retourne TOUJOURS un JSON valide et complet.`
        },
        {
          role: 'user',
          content: analysisPrompt(productInput, inputType, searchResults, categories, additionalData)
        }
      ],
    });

    if (!aiResponse.success) {
      return new Response(
        JSON.stringify({ 
          error: aiResponse.error || 'All AI providers failed',
          code: aiResponse.errorCode || 'PROVIDER_DOWN',
          message: 'Tous les providers IA sont indisponibles. Veuillez réessayer plus tard.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        }
      );
    }

    console.log(`[PRODUCT-ANALYZER] ✅ Analysis completed with provider: ${aiResponse.provider || 'unknown'}`);
    console.log(`[PRODUCT-ANALYZER] Model used: ${preferredModel || 'default'}`);
    
    let analysisContent = aiResponse.content;
    
    // Clean up the response to extract pure JSON
    analysisContent = analysisContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
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

    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisContent);
      
      // Phase 4: Debug logs to trace data structure
      console.log('[PRODUCT-ANALYZER] 🔍 Parsed analysis structure:', {
        has_product_name: !!analysisResult.product_name,
        has_images: !!analysisResult.images,
        has_description: !!analysisResult.description,
        has_description_long: !!analysisResult.description_long,
        top_level_keys: Object.keys(analysisResult).slice(0, 10)
      });
    } catch (parseError) {
      console.error('[PRODUCT-ANALYZER] JSON parse failed, attempting cleanup...', parseError);
      
      let cleanedContent = analysisContent.trim();
      
      const openBraces = (cleanedContent.match(/{/g) || []).length;
      const closeBraces = (cleanedContent.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        cleanedContent += '}'.repeat(openBraces - closeBraces);
      }
      
      try {
        analysisResult = JSON.parse(cleanedContent);
        console.log('[PRODUCT-ANALYZER] Successfully repaired JSON');
      } catch (secondError) {
        console.error('[PRODUCT-ANALYZER] Second parse failed, extracting partial data');
        
        // Phase 3: Better fallback extraction
        analysisResult = {
          product_name: extractField(cleanedContent, 'product_name') || productInput,
          description: extractField(cleanedContent, 'description') || 'N/A',
          description_long: extractField(cleanedContent, 'description_long') || extractField(cleanedContent, 'description') || 'Description non disponible',
          images: extractField(cleanedContent, 'images') || [],
          seo: {
            score: 50,
            keywords: extractField(cleanedContent, 'keywords') || []
          },
          pricing: {
            estimated_price: extractField(cleanedContent, 'estimated_price') || 'N/A'
          },
          global_report: {
            overall_score: 50
          },
          raw_analysis: cleanedContent,
          parsing_error: true
        };
        
        console.log('[PRODUCT-ANALYZER] 🔍 Fallback extraction result:', {
          product_name: analysisResult.product_name,
          has_description: !!analysisResult.description,
          has_images: Array.isArray(analysisResult.images) && analysisResult.images.length > 0
        });
      }
    }

    // Fetch product images if requested
    let imageUrls: string[] = [];
    if (includeImages) {
      try {
        const productName = analysisResult.product_name || productInput;
        console.log(`[PRODUCT-ANALYZER] Fetching images for: ${productName}`);
        
        const { data: imageData, error: imageError } = await supabaseClient.functions.invoke('search-product-images', {
          body: { productName }
        });

        if (!imageError && imageData?.imageUrls) {
          imageUrls = imageData.imageUrls;
          console.log(`[PRODUCT-ANALYZER] Found ${imageUrls.length} images`);
        }
      } catch (imageError) {
        console.error('[PRODUCT-ANALYZER] Image search error:', imageError);
      }
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
        hasWebSearch: searchResults.length > 0,
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
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleError(error, 'PRODUCT-ANALYZER', corsHeaders);
  }
});