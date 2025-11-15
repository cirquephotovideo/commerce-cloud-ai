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

    // Résolution robuste de l'ID d'analyse (peut être un supplier_product_id)
    let effectiveAnalysisId: string = analysisId;

    // 1) Tenter avec product_analyses.id directement
    let { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', effectiveAnalysisId)
      .single();

    // 2) Si non trouvé, essayer de résoudre via product_links (supplier_product_id -> analysis_id)
    if (analysisError || !analysis) {
      console.warn('[ENRICH-ALL] Direct analysis lookup failed, trying via product_links (supplier_product_id)');
      const { data: linkBySupplier } = await supabase
        .from('product_links')
        .select('analysis_id')
        .eq('supplier_product_id', analysisId)
        .maybeSingle();

      if (linkBySupplier?.analysis_id) {
        effectiveAnalysisId = linkBySupplier.analysis_id as string;
        console.log('[ENRICH-ALL] Resolved effectiveAnalysisId via product_links:', effectiveAnalysisId);
        const resolved = await supabase
          .from('product_analyses')
          .select('*')
          .eq('id', effectiveAnalysisId)
          .single();
        analysis = resolved.data as any;
        analysisError = resolved.error as any;
      }
    }

    if (analysisError || !analysis) {
      console.error('[ENRICH-ALL] Analysis not found after resolution attempts:', analysisError);
      throw new Error('Product analysis not found');
    }

    console.log('[ENRICH-ALL] Analysis found:', analysis.id);

    // Récupérer le prix d'achat depuis product_links -> supplier_products
    let purchasePrice = null;
    const { data: linkedProduct } = await supabase
      .from('product_links')
      .select('supplier_products(purchase_price)')
      .eq('analysis_id', effectiveAnalysisId)
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

    // Définir les fonctions d'enrichissement (sans Amazon)
    const enrichmentFunctions: Record<string, string> = {
      environmental: 'enrich-environmental-impact',
      hs_code: 'enrich-hs-code',
      images: 'enrich-product-images',
      description: 'enrich-short-description',
      pricing: 'enrich-pricing'
    };

    console.log('[ENRICH-ALL] Available enrichments:', Object.keys(enrichmentFunctions));

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
            analysisId: effectiveAnalysisId,
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
