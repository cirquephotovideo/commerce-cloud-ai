import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TypeScript Types
interface AnalysisRequest {
  productInput: string;
  inputType?: 'url' | 'name' | 'barcode';
  analysisTypes: ('technical' | 'commercial' | 'market' | 'risk')[];
  platform?: string;
}

interface TechnicalAnalysis {
  product_name: string;
  compatibility?: any;
  specs?: any;
  obsolescence_score?: number;
  lifecycle_stage?: string;
  repairability?: any;
  hs_code?: any;
  environmental_impact?: any;
  error?: string;
  raw_response?: string;
}

interface CommercialAnalysis {
  margin?: any;
  bundles?: any[];
  return_prediction?: any;
}

interface MarketAnalysis {
  competitor_prices?: any[];
  promotion_alerts?: any[];
  seasonality?: any;
}

interface RiskAnalysis {
  compliance_status?: any;
  warranty_analysis?: any;
  authenticity_score?: number;
  risk_level?: string;
}

interface AnalysisResults {
  technical?: TechnicalAnalysis;
  commercial?: CommercialAnalysis;
  market?: MarketAnalysis;
  risk?: RiskAnalysis;
}

interface SuccessResponse {
  success: true;
  results: AnalysisResults;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

type AnalyzerResponse = SuccessResponse | ErrorResponse;

// Helper function for safe JSON parsing
function safeParseAIResponse(content: string, analysisType: string): any {
  try {
    // Clean content
    content = content.trim();
    
    // Extract JSON if wrapped in text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    return JSON.parse(content);
  } catch (parseError) {
    console.error(`Error parsing ${analysisType} JSON:`, parseError);
    console.error('Content received:', content.substring(0, 500));
    
    return {
      error: `Failed to parse ${analysisType} analysis response`,
      raw_response: content.substring(0, 500)
    };
  }
}

// Phase B.7: Helper function to call AI analysis with automatic provider fallback
async function callAIAnalysis(
  promptContent: string, 
  analysisType: string, 
  lovableApiKey: string
): Promise<any> {
  const aiProviders = ['lovable_ai', 'openai', 'openrouter'];
  
  for (const provider of aiProviders) {
    const apiKey = Deno.env.get(
      provider === 'lovable_ai' ? 'LOVABLE_API_KEY' :
      provider === 'openai' ? 'OPENAI_API_KEY' :
      'OPENROUTER_API_KEY'
    );

    if (!apiKey) {
      console.log(`[ADVANCED-ANALYZER] Skipping ${provider} (no API key)`);
      continue;
    }

    try {
      const endpoint = 
        provider === 'lovable_ai' ? 'https://ai.gateway.lovable.dev/v1/chat/completions' :
        provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
        'https://openrouter.ai/api/v1/chat/completions';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider === 'lovable_ai' ? 'google/gemini-2.5-flash' : 
                 provider === 'openai' ? 'gpt-5-nano-2025-08-07' : 
                 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: promptContent }],
        }),
      });

      if (!response.ok) {
        console.error(`[ADVANCED-ANALYZER] ${analysisType} ${provider} API error:`, response.status);
        
        // Retry on retriable errors
        if (response.status === 402 || response.status === 429 || response.status === 503) {
          console.warn(`[ADVANCED-ANALYZER] ${provider} failed (${response.status}), trying next provider...`);
          continue;
        }
        
        // Non-retriable error
        return {
          error: `AI API error: ${response.status}`,
          code: response.status === 402 ? 'PAYMENT_REQUIRED' : 
                response.status === 429 ? 'RATE_LIMIT' : 
                'PROVIDER_ERROR',
          type: analysisType
        };
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]) {
        console.error(`[ADVANCED-ANALYZER] Invalid ${analysisType} response structure from ${provider}`);
        continue;
      }

      console.log(`[ADVANCED-ANALYZER] ${analysisType} success with ${provider}`);
      return safeParseAIResponse(data.choices[0].message.content, analysisType);
      
    } catch (error) {
      console.error(`[ADVANCED-ANALYZER] ${analysisType} ${provider} exception:`, error);
      continue;
    }
  }

  // All providers failed
  return {
    error: 'All AI providers failed',
    code: 'PROVIDER_DOWN',
    type: analysisType
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate ALL required environment variables upfront
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const missingVars: string[] = [];
    if (!LOVABLE_API_KEY) missingVars.push('LOVABLE_API_KEY');
    if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return new Response(JSON.stringify({
        success: false,
        error: `Missing environment variables: ${missingVars.join(', ')}`,
        code: 'MISSING_ENV_VARS'
      } as ErrorResponse), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX');

    console.log('Environment variables validated ✓');

    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header required',
        code: 'NO_AUTH_HEADER'
      } as ErrorResponse), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired token',
        code: 'AUTHENTICATION_FAILED',
        details: authError?.message
      } as ErrorResponse), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.email);

    // Parse and validate request body
    let requestData: Partial<AnalysisRequest>;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('Invalid JSON in request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body',
        code: 'INVALID_REQUEST_BODY'
      } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      productInput, 
      inputType = 'url', 
      analysisTypes, 
      platform 
    } = requestData;

    // Validate required fields
    if (!productInput || typeof productInput !== 'string' || productInput.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'productInput is required and must be a non-empty string',
        code: 'MISSING_PRODUCT_INPUT'
      } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!analysisTypes || !Array.isArray(analysisTypes) || analysisTypes.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'analysisTypes is required and must be a non-empty array',
        code: 'MISSING_ANALYSIS_TYPES',
        hint: 'Valid types: technical, commercial, market, risk'
      } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate analysis types
    const validTypes = ['technical', 'commercial', 'market', 'risk'];
    const invalidTypes = analysisTypes.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid analysis types: ${invalidTypes.join(', ')}`,
        code: 'INVALID_ANALYSIS_TYPES',
        hint: `Valid types are: ${validTypes.join(', ')}`
      } as ErrorResponse), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Request validated:', { productInput, inputType, analysisTypes, platform });
    
    // Determine the product identifier based on input type
    let productIdentifier = productInput;
    if (inputType === 'name' || inputType === 'barcode') {
      productIdentifier = `${inputType === 'barcode' ? 'Code-barres' : 'Nom de produit'}: ${productInput}`;
    }

    const results: any = {};

    // Technical Analysis
    if (analysisTypes.includes('technical')) {
      let platformInstructions = '';
      if (platform && platform !== 'auto') {
        platformInstructions = `\n\nSource prioritaire: ${platform}
Utilise les données spécifiques à cette plateforme pour l'analyse.`;
      }

      const technicalPrompt = `Analyse technique approfondie du produit: ${productIdentifier}${platformInstructions}
      
      IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.
      Ne commence PAS par "Voici", "Il semblerait", etc.
      Commence directement par { et termine par }.
      
      Fournis:
      1. Nom du produit identifié
      2. Compatibilité: Liste les produits compatibles/incompatibles, accessoires requis
      3. Spécifications: Analyse détaillée des specs techniques
      4. Obsolescence: Score (0-1) et stade de cycle de vie (new/mature/declining/obsolete)
      5. Restrictions régionales: Voltage, normes, limitations géographiques
      6. Éco-texte et réparabilité: Score (0-10), facilité, disponibilité pièces, durabilité
      7. Code douanier HS: Code à 6-8 chiffres avec description
      8. Impact environnemental: Émissions CO2, recyclabilité, certifications environnementales
      
      Format JSON strict:
      {
        "product_name": "Nom du produit",
        "compatibility": { "compatible": [], "incompatible": [], "required_accessories": [], "regional_restrictions": {} },
        "specs": { "key_specs": {}, "technical_details": {} },
        "obsolescence_score": 0.0,
        "lifecycle_stage": "mature",
        "repairability": {
          "score": 7.5,
          "ease_of_repair": "facile/moyen/difficile",
          "spare_parts_availability": "excellente/bonne/moyenne/limitée",
          "durability_score": 8.0,
          "repairability_index": "8.5/10"
        },
        "hs_code": {
          "code": "854230",
          "description": "Description de la catégorie douanière"
        },
        "environmental_impact": {
          "carbon_footprint": "Estimation des émissions CO2",
          "recyclability_score": 7.5,
          "eco_certifications": ["Energy Star", "EPEAT Gold"],
          "energy_efficiency": "A++",
          "eco_score": 8.0
        }
      }`;

      results.technical = await callAIAnalysis(technicalPrompt, 'technical', LOVABLE_API_KEY!);
      console.log('Technical analysis completed');
    }

    // Commercial Optimization
    if (analysisTypes.includes('commercial')) {
      const commercialPrompt = `Optimisation commerciale pour: ${productIdentifier}
      
      Calcule:
      1. Marge dynamique recommandée (min/max)
      2. Suggestions de bundles rentables
      3. Prédiction de taux de retours (0-1)
      4. Estimation coûts SAV
      
      Format JSON:
      {
        "margin": { "min": 0, "max": 0, "recommended": 0 },
        "bundles": [{ "products": [], "perceived_value": 0, "profit_margin": 0 }],
        "return_prediction": { "rate": 0.0, "main_causes": [], "sav_cost_estimate": 0 }
      }`;

      results.commercial = await callAIAnalysis(commercialPrompt, 'commercial', LOVABLE_API_KEY!);
      console.log('Commercial analysis completed');
    }

    // Market Intelligence with Web Search
    if (analysisTypes.includes('market') && GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_CX) {
      const searchQuery = `${productInput} prix concurrents`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const marketPrompt = `Analyse de marché basée sur ces données: ${JSON.stringify(searchData.items?.slice(0, 5) || [])}
      
      Fournis:
      1. Prix concurrents détectés
      2. Alertes promotions
      3. Saisonnalité prédite
      
      Format JSON:
      {
        "competitor_prices": [{ "site": "", "price": 0, "url": "" }],
        "promotion_alerts": [],
        "seasonality": { "peak_periods": [], "low_periods": [] }
      }`;

      results.market = await callAIAnalysis(marketPrompt, 'market', LOVABLE_API_KEY!);
      console.log('Market analysis completed');
    }

    // Risk Assessment
    if (analysisTypes.includes('risk')) {
      const riskPrompt = `Évaluation des risques pour: ${productIdentifier}
      
      Évalue:
      1. Conformité (CE, RoHS, DEEE) - status de chaque norme
      2. Analyse garantie - coûts, recommandations
      3. Score d'authenticité (0-1)
      4. Niveau de risque global (low/medium/high)
      
      Format JSON:
      {
        "compliance_status": { "CE": "", "RoHS": "", "DEEE": "" },
        "warranty_analysis": { "cost_estimate": 0, "recommendations": [] },
        "authenticity_score": 0.0,
        "risk_level": "low"
      }`;

      results.risk = await callAIAnalysis(riskPrompt, 'risk', LOVABLE_API_KEY!);
      console.log('Risk analysis completed');
    }

    console.log('All analyses completed successfully:', Object.keys(results));
    
    return new Response(JSON.stringify({ success: true, results } as SuccessResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in advanced-product-analyzer:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined
    } as ErrorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});