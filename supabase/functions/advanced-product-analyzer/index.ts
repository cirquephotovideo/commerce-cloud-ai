import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  usedProviders?: Record<string, string>;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

type AnalyzerResponse = SuccessResponse | ErrorResponse;

function safeParseAIResponse(content: string, analysisType: string): any {
  try {
    content = content.trim();
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    return JSON.parse(content);
  } catch (parseError) {
    console.error(`[ADVANCED-ANALYZER] Error parsing ${analysisType} JSON:`, parseError);
    console.error('[ADVANCED-ANALYZER] Content received:', content.substring(0, 500));
    
    return {
      error: `Failed to parse ${analysisType} analysis response`,
      raw_response: content.substring(0, 500)
    };
  }
}

async function callAIAnalysis(
  promptContent: string, 
  analysisType: string
): Promise<any> {
  const aiResponse = await callAIWithFallback({
    model: 'llama3.2', // Default Ollama model
    messages: [{ role: 'user', content: promptContent }],
  });

  if (!aiResponse.success) {
    return {
      error: aiResponse.error || 'AI analysis failed',
      code: aiResponse.errorCode || 'PROVIDER_ERROR',
      type: analysisType
    };
  }

  const data = aiResponse.content;
  
  if (!data.choices || !data.choices[0]) {
    console.error(`[ADVANCED-ANALYZER] Invalid ${analysisType} response structure`);
    return {
      error: 'Invalid response structure',
      code: 'INVALID_RESPONSE',
      type: analysisType
    };
  }

  console.log(`[ADVANCED-ANALYZER] ${analysisType} success with ${aiResponse.provider}`);
  return {
    ...safeParseAIResponse(data.choices[0].message.content, analysisType),
    _provider: aiResponse.provider
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const missingVars: string[] = [];
    if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
    if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

    if (missingVars.length > 0) {
      console.error('[ADVANCED-ANALYZER] Missing environment variables:', missingVars);
      return new Response(JSON.stringify({
        success: false,
        error: `Missing environment variables: ${missingVars.join(', ')}`,
        code: 'MISSING_ENV_VARS'
      } as ErrorResponse), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ADVANCED-ANALYZER] Environment variables validated ✓');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[ADVANCED-ANALYZER] Missing Authorization header');
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
      console.error('[ADVANCED-ANALYZER] Authentication failed:', authError);
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

    console.log('[ADVANCED-ANALYZER] User authenticated:', user.email);

    let requestData: Partial<AnalysisRequest>;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('[ADVANCED-ANALYZER] Invalid JSON in request body:', parseError);
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

    console.log('[ADVANCED-ANALYZER] Request validated:', { productInput, inputType, analysisTypes, platform });
    
    let productIdentifier = productInput;
    if (inputType === 'name' || inputType === 'barcode') {
      productIdentifier = `${inputType === 'barcode' ? 'Code-barres' : 'Nom de produit'}: ${productInput}`;
    }

    const results: any = {};
    const usedProviders: Record<string, string> = {};

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

      const techResult = await callAIAnalysis(technicalPrompt, 'technical');
      results.technical = techResult;
      if (techResult._provider) {
        usedProviders.technical = techResult._provider;
        delete techResult._provider;
      }
      console.log('[ADVANCED-ANALYZER] Technical analysis completed');
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

      const commResult = await callAIAnalysis(commercialPrompt, 'commercial');
      results.commercial = commResult;
      if (commResult._provider) {
        usedProviders.commercial = commResult._provider;
        delete commResult._provider;
      }
      console.log('[ADVANCED-ANALYZER] Commercial analysis completed');
    }

    // Market Intelligence with Web Search
    if (analysisTypes.includes('market')) {
      const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
      let searchData: any = null;
      
      if (SERPER_API_KEY) {
        try {
          const searchQuery = `${productInput} prix concurrents`;
          const searchResponse = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: searchQuery, num: 5 })
          });
          
          if (searchResponse.ok) {
            searchData = await searchResponse.json();
          }
        } catch (error) {
          console.error('[ADVANCED-ANALYZER] Search error:', error);
        }
      }

      const marketPrompt = `Analyse de marché ${searchData ? `basée sur ces données: ${JSON.stringify(searchData.organic?.slice(0, 5) || [])}` : `pour: ${productIdentifier}`}
      
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

      const marketResult = await callAIAnalysis(marketPrompt, 'market');
      results.market = marketResult;
      if (marketResult._provider) {
        usedProviders.market = marketResult._provider;
        delete marketResult._provider;
      }
      console.log('[ADVANCED-ANALYZER] Market analysis completed');
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

      const riskResult = await callAIAnalysis(riskPrompt, 'risk');
      results.risk = riskResult;
      if (riskResult._provider) {
        usedProviders.risk = riskResult._provider;
        delete riskResult._provider;
      }
      console.log('[ADVANCED-ANALYZER] Risk analysis completed');
    }

    console.log('[ADVANCED-ANALYZER] All analyses completed successfully:', Object.keys(results));
    console.log('[ADVANCED-ANALYZER] Providers used:', usedProviders);
    
    return new Response(JSON.stringify({ 
      success: true, 
      results,
      usedProviders
    } as SuccessResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ADVANCED-ANALYZER] Error:', {
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