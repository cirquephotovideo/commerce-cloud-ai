import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[RE-ENRICH] No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('[RE-ENRICH] Authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RE-ENRICH] User authenticated: ${user.id}`);

    const { productId, enrichmentTypes, provider } = await req.json();

    if (!productId) {
      console.error('[RE-ENRICH] No product ID provided');
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RE-ENRICH] Starting re-enrichment for product ${productId} with provider ${provider || 'lovable-ai'}`);

    // Try to find as product_analysis first
    const { data: analysisData, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*, supplier_product_id')
      .eq('id', productId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (analysisError) {
      console.error('[RE-ENRICH] Error fetching analysis:', analysisError);
    }

    let supplierProduct = null;
    let analysis = null;

    if (analysisData) {
      console.log('[RE-ENRICH] Found as product_analysis ID');
      analysis = analysisData;
      
      // Get the linked supplier product if exists
      if (analysisData.supplier_product_id) {
        const { data: sp, error: spError } = await supabase
          .from('supplier_products')
          .select('*')
          .eq('id', analysisData.supplier_product_id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (spError) {
          console.error('[RE-ENRICH] Error fetching linked supplier product:', spError);
        } else if (sp) {
          supplierProduct = sp;
          console.log('[RE-ENRICH] Found linked supplier product');
        }
      }
    } else {
      console.log('[RE-ENRICH] Not found as analysis, trying as supplier_product ID');
      // Try as supplier_product ID
      const { data: sp, error: spError } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('id', productId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (spError) {
        console.error('[RE-ENRICH] Error fetching supplier product:', spError);
      }

      if (sp) {
        console.log('[RE-ENRICH] Found as supplier_product ID');
        supplierProduct = sp;
        
        // Check if there's a linked analysis
        const { data: linkedAnalysis, error: linkedError } = await supabase
          .from('product_analyses')
          .select('*')
          .eq('supplier_product_id', sp.id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (linkedError) {
          console.error('[RE-ENRICH] Error fetching linked analysis:', linkedError);
        } else if (linkedAnalysis) {
          analysis = linkedAnalysis;
          console.log('[RE-ENRICH] Found linked analysis');
        }
      }
    }

    if (!supplierProduct && !analysis) {
      console.error('[RE-ENRICH] Product not found - neither supplier product nor analysis exists');
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RE-ENRICH] Product data resolved - supplier: ${!!supplierProduct}, analysis: ${!!analysis}`);

    // If we have analysis but no supplier product, we can still work with analysis data
    const productData = supplierProduct || {
      name: analysis?.analysis_result?.product_name || 'Unknown Product',
      ean: analysis?.analysis_result?.ean || null,
      description: analysis?.analysis_result?.description || null
    };

    // Determine which enrichments to run
    const enrichmentsToRun = enrichmentTypes || ['amazon', 'ai_analysis'];

    // Add to enrichment queue with high priority
    const { data: queueEntry, error: queueError } = await supabase
      .from('enrichment_queue')
      .insert({
        user_id: user.id,
        supplier_product_id: supplierProduct?.id || null,
        analysis_id: analysis?.id || null,
        enrichment_type: enrichmentsToRun,
        priority: 'high',
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      throw new Error(`Failed to queue re-enrichment: ${queueError.message}`);
    }

    // Update analysis tracking if analysis exists
    if (analysis) {
      await supabase
        .from('product_analyses')
        .update({
          last_auto_enrichment_at: new Date().toISOString(),
          auto_enrichment_count: (analysis.auto_enrichment_count || 0) + 1
        })
        .eq('id', analysis.id);
    }

    // Process the enrichment immediately
    console.log('[RE-ENRICH] Invoking product-analyzer...');
    try {
      // Call product analyzer
      if (enrichmentsToRun.includes('amazon') || enrichmentsToRun.includes('ai_analysis')) {
        const { data: analyzerResult, error: analyzerError } = await supabase.functions.invoke(
          'product-analyzer',
          {
            body: {
              product: {
                name: productData.name,
                ean: productData.ean,
                purchase_price: productData.purchase_price || null,
                description: productData.description
              },
              enrichmentOptions: enrichmentsToRun,
              provider: provider || 'lovable-ai'
            }
          }
        );

        if (analyzerError) {
          console.error('[RE-ENRICH] Analyzer error:', analyzerError);
        } else {
          // Update or create analysis with new data
          if (analysis) {
            await supabase
              .from('product_analyses')
              .update({
                analysis_result: analyzerResult,
                enrichment_status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', analysis.id);
          } else {
            // Create new analysis if none exists
            await supabase
              .from('product_analyses')
              .insert({
                user_id: user.id,
                supplier_product_id: supplierProduct.id,
                analysis_result: analyzerResult,
                enrichment_status: 'completed'
              });
          }

          // Update queue status
          await supabase
            .from('enrichment_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', queueEntry.id);

          // Create success alert
          await supabase.from('user_alerts').insert({
            user_id: user.id,
            alert_type: 'enrichment_complete',
            severity: 'info',
            title: 'Re-enrichissement terminé',
            message: `Le produit "${productData.name}" a été enrichi avec succès.`,
            related_product_id: supplierProduct?.id || null,
            action_url: supplierProduct?.id ? `/imported-products?highlight=${supplierProduct.id}` : '/dashboard'
          });
        }
      }
    } catch (enrichError) {
      console.error('[RE-ENRICH] Enrichment error:', enrichError);
      
      await supabase
        .from('enrichment_queue')
        .update({
          status: 'failed',
          error_message: enrichError instanceof Error ? enrichError.message : 'Unknown error'
        })
        .eq('id', queueEntry.id);
    }

    console.log(`[RE-ENRICH] Re-enrichment completed for product ${productId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Re-enrichment started successfully',
        queue_id: queueEntry.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RE-ENRICH] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
