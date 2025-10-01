import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const analysisPrompt = (productInfo: string, inputType: string, searchResults: SearchResult[]) => {
  const searchContext = searchResults.length > 0 
    ? `\n\nInformations trouvées sur le web:\n${searchResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
    : '';

  return `Analyse complète du produit e-commerce.

Type d'entrée: ${inputType}
${inputType === 'url' ? `URL du produit: ${productInfo}` : 
  inputType === 'barcode' ? `Code-barres: ${productInfo}` : 
  `Nom du produit: ${productInfo}`}
${searchContext}

Effectue une analyse détaillée et structure ta réponse EXACTEMENT selon ce format JSON (important: retourne UNIQUEMENT le JSON, pas de texte avant ou après):

{
  "product_name": "Nom du produit identifié",
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
    const { productInput } = await req.json();
    console.log('Analyzing product:', productInput);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
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
            content: 'Tu es un expert en analyse e-commerce. Tu dois retourner UNIQUEMENT un objet JSON valide, sans texte markdown, sans balises de code, juste le JSON pur.'
          },
          {
            role: 'user',
            content: analysisPrompt(productInput, inputType, searchResults)
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
    
    // Try to parse as JSON
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Raw content:', analysisContent);
      // Return the raw content if JSON parsing fails
      analysisResult = {
        raw_analysis: analysisContent,
        error: 'Could not parse structured response'
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        productInput,
        inputType,
        analysis: analysisResult,
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
