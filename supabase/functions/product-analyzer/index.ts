import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { handleError } from '../_shared/error-handler.ts';
import { PromptTemplates } from '../_shared/prompt-templates.ts';
import { validateAnalysis } from '../_shared/validation.ts';

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

// Use the new comprehensive prompt template
const analysisPrompt = (productInfo: string, inputType: string, categories: any[], additionalData?: any) => {
  return PromptTemplates.initialAnalysis(productInfo, inputType, categories, additionalData);
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

    if (!aiResponse.success || !aiResponse.content) {
      console.error('[PRODUCT-ANALYZER] ❌ AI call failed:', aiResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          code: aiResponse.errorCode || 'AI_CALL_FAILED',
          message: aiResponse.error || 'AI processing failed',
          provider: aiResponse.provider,
          http_status: 500
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDATE RESPONSE BEFORE PARSING
    if (!aiResponse.content || aiResponse.content.trim().length === 0) {
      console.error('[PRODUCT-ANALYZER] ❌ Empty AI response');
      return new Response(
        JSON.stringify({ 
          success: false,
          code: 'EMPTY_AI_RESPONSE',
          message: 'AI returned empty response',
          provider: aiResponse.provider
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Use the new validation system
    const validateAnalysisCompleteness = (analysis: any): { incomplete: boolean; missingFields: string[] } => {
      const validationResult = validateAnalysis(analysis);
      return {
        incomplete: !validationResult.isValid,
        missingFields: validationResult.missingFields
      };
    };

    let analysisResult;
    let isPartialParse = false;
    
    try {
      const repairedContent = repairJSON(analysisContent);
      analysisResult = JSON.parse(repairedContent);
      
      console.log('[PRODUCT-ANALYZER] ✅ JSON parsed successfully');
      console.log('[PRODUCT-ANALYZER] 🔍 Parsed analysis structure:', {
        has_product_name: !!analysisResult.product_name,
        has_images: !!analysisResult.images,
        has_description: !!analysisResult.description,
        has_description_long: !!analysisResult.description_long,
        top_level_keys: Object.keys(analysisResult).slice(0, 10)
      });
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      console.error('[PRODUCT-ANALYZER] ❌ JSON parsing failed:', {
        error: errorMessage,
        contentLength: analysisContent.length,
        contentPreview: analysisContent.substring(0, 300),
        provider: aiResponse.provider
      });
      
      return new Response(
        JSON.stringify({ 
          success: false,
          code: 'JSON_PARSE_ERROR',
          message: 'Failed to parse AI response as valid JSON',
          details: {
            parseError: errorMessage,
            contentPreview: analysisContent.substring(0, 200),
            contentLength: analysisContent.length
          },
          provider: aiResponse.provider
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ✅ CRITICAL VALIDATION: Check completeness
    const validation = validateAnalysisCompleteness(analysisResult);
    
    // If critical fields are missing, return structured error
    if (!analysisResult.product_name) {
      console.error('[PRODUCT-ANALYZER] ❌ Critical field missing: product_name');
      return new Response(
        JSON.stringify({ 
          success: false,
          code: 'INCOMPLETE_ANALYSIS',
          message: 'AI response missing critical field: product_name',
          details: {
            missingFields: validation.missingFields,
            hasDescription: !!analysisResult.description,
            hasBrand: !!analysisResult.brand,
            receivedKeys: Object.keys(analysisResult)
          },
          provider: aiResponse.provider
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (validation.incomplete || isPartialParse) {
      analysisResult._incomplete = true;
      analysisResult._missing_fields = validation.missingFields;
      analysisResult._needs_reanalysis = true;
      console.warn('[PRODUCT-ANALYZER] ⚠️ Analysis incomplete but acceptable:', {
        missing_fields: validation.missingFields,
        partial_parse: isPartialParse
      });
    }

    // Fetch and store official product images
    let imageUrls: string[] = [];
    let imageSources: string[] = [];
    if (includeImages) {
      try {
        const productName = analysisResult.product_name || productInput;
        const brand = analysisResult.brand || additionalData?.brand;
        const ean = analysisResult.ean_code || additionalData?.ean;
        const asin = additionalData?.asin;
        
        console.log(`[PRODUCT-ANALYZER] 📸 Fetching and storing official images for: "${productName}"`);
        
        // Generate a temporary analysis ID for image storage
        const tempAnalysisId = crypto.randomUUID();
        
        const { data: imageData, error: imageError } = await supabaseClient.functions.invoke('fetch-and-store-official-images', {
          body: { 
            productName,
            brand,
            productUrl: inputType === 'url' ? productInput : null,
            ean,
            asin,
            analysisId: tempAnalysisId
          }
        });

        console.log('[PRODUCT-ANALYZER] Image fetch response:', {
          hasError: !!imageError,
          error: imageError,
          imageCount: imageData?.images?.length || 0,
          sources: imageData?.sources || []
        });

        if (!imageError && imageData?.images) {
          imageUrls = imageData.images;
          imageSources = imageData.sources || [];
          console.log(`[PRODUCT-ANALYZER] ✅ Stored ${imageUrls.length} images from: ${imageSources.join(', ')}`);
        } else if (imageError) {
          console.error('[PRODUCT-ANALYZER] ❌ Image fetch error:', imageError);
        }
      } catch (imageError) {
        console.error('[PRODUCT-ANALYZER] ❌ Image fetch exception:', imageError);
      }
    } else {
      console.log('[PRODUCT-ANALYZER] ⏭️ Image fetch skipped (includeImages = false)');
    }

    // Validate analysis completeness
    const validationResult = validateAnalysis(analysisResult);
    if (!validationResult.isValid) {
      console.log('[PRODUCT-ANALYZER] ⚠️ Analysis incomplete:', validationResult.missingFields);
      analysisResult._incomplete = true;
      analysisResult._missing_fields = validationResult.missingFields;
      analysisResult._completeness_score = validationResult.completeness_score;
      analysisResult._confidence_level = validationResult.confidence;
    }

    // Phase 1: Flatten structure - return data directly, not wrapped in "analysis"
    const responseData = {
      ...analysisResult,
      imageUrls,
      imageSources,
      usedProvider: aiResponse.provider,
      _provider: aiResponse.provider,
      _model: preferredModel || 'default',
      _timestamp: new Date().toISOString(),
      metadata: {
        inputType,
        hasWebSearch: true,
        hasCategories: categories.length > 0,
        imageSourcesUsed: imageSources,
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