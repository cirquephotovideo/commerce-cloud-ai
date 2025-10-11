import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': Deno.env.get('BRAVE_SEARCH_API_KEY') || ''
      }
    });
    
    if (!response.ok) {
      console.log('Search API not available, continuing without web search');
      return [];
    }
    
    const data = await response.json();
    return data.web?.results?.slice(0, 5).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    })) || [];
  } catch (error) {
    console.log('Web search error:', error);
    return [];
  }
}

function detectInputType(input: string): 'url' | 'barcode' | 'product_name' {
  // Check if it's a URL
  if (input.match(/^https?:\/\//i)) {
    return 'url';
  }
  
  // Check if it's a barcode (numeric, 8-13 digits)
  if (input.match(/^\d{8,13}$/)) {
    return 'barcode';
  }
  
  // Otherwise it's a product name
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
    
    // Handle multiple input formats
    let productInput: string;
    let additionalData: any = {};
    let includeImages = true;

    if (typeof body === 'string') {
      productInput = body;
    } else if (body.productInput) {
      productInput = body.productInput;
      additionalData = body.additionalData || {};
      includeImages = body.includeImages !== false;
    } else if (body.name) {
      // Backward compatibility with old format
      productInput = body.name;
      additionalData = body;
    } else {
      throw new Error('Missing productInput, name, or structured data');
    }

    console.log('Analyzing product:', productInput);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    let categories: any[] = [];

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id;

      // Fetch user's Odoo categories
      if (userId) {
        const { data: categoriesData } = await supabaseClient
          .from('odoo_categories')
          .select('*')
          .eq('user_id', userId);
        
        categories = categoriesData || [];
        console.log(`Found ${categories.length} Odoo categories for user`);
      }
    }

    // Detect input type
    const inputType = detectInputType(productInput);
    console.log('Input type detected:', inputType);

    // Perform web search for additional context
    let searchQuery = productInput;
    if (inputType === 'barcode') {
      searchQuery = `produit code-barres ${productInput} prix avis`;
    } else if (inputType === 'product_name') {
      searchQuery = `${productInput} acheter prix avis e-commerce`;
    }

    console.log('Searching web for:', searchQuery);
    const searchResults = await searchWeb(searchQuery);
    console.log('Found', searchResults.length, 'search results');

    console.log('Calling Lovable AI for product analysis...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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

Structure minimale requise:
{
  "product_name": "string",
  "description": "string",
  "description_long": "string",
  "seo": { "score": number, "keywords": [] },
  "pricing": { "estimated_price": "string" },
  "global_report": { "overall_score": number }
}

Si tu ne peux pas analyser complètement, remplis les champs manquants avec "N/A" ou des valeurs par défaut, mais retourne TOUJOURS un JSON valide et complet.`
          },
          {
            role: 'user',
            content: analysisPrompt(productInput, inputType, searchResults, categories, additionalData)
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte. Veuillez réessayer dans quelques instants.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Analysis complete');
    
    let analysisContent = data.choices[0].message.content;
    
    // Clean up the response to extract pure JSON
    analysisContent = analysisContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Helper to extract field from partial JSON
    const extractField = (content: string, field: string): string => {
      const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i');
      const match = content.match(regex);
      return match ? match[1] : 'N/A';
    };

    // Try to parse as JSON with robust error handling
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('JSON parse failed, attempting cleanup...', parseError);
      
      // Try to repair truncated JSON
      let cleanedContent = analysisContent.trim();
      
      // Close unclosed braces/brackets
      const openBraces = (cleanedContent.match(/{/g) || []).length;
      const closeBraces = (cleanedContent.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        cleanedContent += '}'.repeat(openBraces - closeBraces);
      }
      
      try {
        analysisResult = JSON.parse(cleanedContent);
        console.log('Successfully repaired JSON');
      } catch (secondError) {
        console.error('Second parse failed, cannot extract valid data');
        console.error('Raw response sample:', analysisContent.substring(0, 200));
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Impossible d\'analyser la réponse de l\'IA. Le format JSON retourné est invalide.',
            details: 'L\'IA n\'a pas retourné un JSON valide malgré plusieurs tentatives de réparation.',
            rawSample: analysisContent.substring(0, 200)
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
    }

    // CRITICAL: Verify analysisResult is valid before continuing
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.error('FATAL: analysisResult is null or not an object');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Structure d\'analyse invalide',
          details: 'L\'analyse n\'a pas retourné un objet valide'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Ensure at least product_name exists
    if (!analysisResult.product_name || typeof analysisResult.product_name !== 'string') {
      console.warn('Missing or invalid product_name, using input as fallback');
      analysisResult.product_name = productInput;
    }

    // Search for product images if requested
    let imageUrls: string[] = [];
    if (includeImages) {
      console.log('Searching for product images...');
      try {
        // Use the search-product-images function for better image results
        // Safely get product name with fallback
        const productNameForImages = analysisResult?.product_name || productInput;
        
        if (!productNameForImages) {
          console.warn('No product name available for image search, skipping...');
        } else {
          const { data: imageData, error: imageError } = await supabaseClient.functions.invoke(
            'search-product-images',
            {
              body: { 
                productName: productNameForImages,
                maxResults: 8
              }
            }
          );

          if (imageError) {
            console.error('Error invoking search-product-images:', imageError);
          } else if (imageData?.images) {
            imageUrls = imageData.images.map((img: any) => img.url).filter(Boolean);
            console.log(`Found ${imageUrls.length} images via search-product-images function`);
          } else {
            console.log('No images found or unexpected response format');
          }
        }
      } catch (imageError) {
        console.error('Error searching images:', imageError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        productInput,
        inputType,
        analysis: analysisResult,
        imageUrls,
        searchResultsCount: searchResults.length,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in product-analyzer function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
