import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, sections = [] } = await req.json();
    console.log('[ENRICH-ALL] Starting enrichment for analysis:', analysisId);
    console.log('[ENRICH-ALL] Sections to enrich:', sections);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Récupérer les données du produit
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      console.error('[ENRICH-ALL] Analysis not found:', analysisError);
      throw new Error('Product analysis not found');
    }

    console.log('[ENRICH-ALL] Analysis found:', analysis.id);

    // Récupérer le prix d'achat depuis product_links -> supplier_products
    let purchasePrice = null;
    const { data: linkedProduct } = await supabase
      .from('product_links')
      .select('supplier_products(purchase_price)')
      .eq('analysis_id', analysisId)
      .maybeSingle();
    
    if (linkedProduct?.supplier_products) {
      purchasePrice = (linkedProduct.supplier_products as any).purchase_price;
    }

    // Préparer les données produit
    const productData = {
      name: analysis.analysis_result?.product_name || analysis.analysis_result?.description || 'Produit',
      ean: analysis.ean,
      brand: analysis.analysis_result?.brand,
      category: analysis.analysis_result?.category,
      description: analysis.long_description
    };

    console.log('[ENRICH-ALL] Product data:', productData);

    // Définir les fonctions d'enrichissement
    const enrichmentFunctions: Record<string, string> = {
      environmental: 'enrich-environmental-impact',
      hs_code: 'enrich-hs-code',
      images: 'enrich-product-images',
      description: 'enrich-short-description',
      pricing: 'enrich-pricing'
    };

    // Lancer tous les enrichissements en parallèle
    const enrichmentPromises = sections.map(async (section: string) => {
      const functionName = enrichmentFunctions[section];
      if (!functionName) {
        return {
          section,
          status: 'failed',
          error: 'Unknown enrichment section'
        };
      }

      try {
        console.log(`[ENRICH-ALL] Starting ${section} enrichment...`);
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: {
            analysisId,
            productData,
            ...(section === 'pricing' && purchasePrice ? { purchasePrice } : {})
          }
        });

        if (error) {
          throw error;
        }

        if (data && !data.success) {
          throw new Error(data.error || 'Enrichment failed');
        }

        console.log(`[ENRICH-ALL] ✅ ${section} completed`);
        
        return {
          section,
          status: 'success',
          data: data?.data
        };
      } catch (error) {
        console.error(`[ENRICH-ALL] ❌ ${section} failed:`, error);
        
        return {
          section,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Attendre tous les enrichissements
    const results = await Promise.allSettled(enrichmentPromises);

    // Construire le rapport
    const enrichments: Record<string, any> = {};
    let successCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const enrichmentResult = result.value;
        enrichments[enrichmentResult.section] = enrichmentResult;
        if (enrichmentResult.status === 'success') {
          successCount++;
        }
      } else {
        // Promise rejetée
        enrichments.unknown = {
          status: 'failed',
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    const completionRate = Math.round((successCount / sections.length) * 100);

    console.log('[ENRICH-ALL] ✅ Enrichment completed:', {
      total: sections.length,
      success: successCount,
      completionRate: `${completionRate}%`
    });

    return new Response(
      JSON.stringify({
        success: true,
        enrichments,
        completionRate,
        successCount,
        totalCount: sections.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-ALL] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
