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
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    const { productId, enrichmentTypes } = await req.json();

    if (!productId) {
      throw new Error('Product ID is required');
    }

    console.log(`[RE-ENRICH] Starting re-enrichment for product ${productId}`);

    // Get the product analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*, supplier_products(*)')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Product not found or access denied');
    }

    // Get supplier product details
    const supplierProduct = analysis.supplier_products;
    
    if (!supplierProduct) {
      throw new Error('Supplier product not found');
    }

    // Determine which enrichments to run
    const enrichmentsToRun = enrichmentTypes || ['amazon', 'ai_analysis'];

    // Add to enrichment queue with high priority
    const { data: queueEntry, error: queueError } = await supabase
      .from('enrichment_queue')
      .insert({
        user_id: user.id,
        supplier_product_id: supplierProduct.id,
        analysis_id: productId,
        enrichment_type: enrichmentsToRun,
        priority: 'high',
        status: 'pending'
      })
      .select()
      .single();

    if (queueError) {
      throw new Error(`Failed to queue re-enrichment: ${queueError.message}`);
    }

    // Update analysis tracking
    await supabase
      .from('product_analyses')
      .update({
        last_auto_enrichment_at: new Date().toISOString(),
        auto_enrichment_count: (analysis.auto_enrichment_count || 0) + 1
      })
      .eq('id', productId);

    // Process the enrichment immediately
    try {
      // Call product analyzer
      if (enrichmentsToRun.includes('amazon') || enrichmentsToRun.includes('ai_analysis')) {
        const { data: analyzerResult, error: analyzerError } = await supabase.functions.invoke(
          'product-analyzer',
          {
            body: {
              product: {
                name: supplierProduct.name,
                ean: supplierProduct.ean,
                purchase_price: supplierProduct.purchase_price,
                description: supplierProduct.description
              },
              enrichmentOptions: enrichmentsToRun
            }
          }
        );

        if (analyzerError) {
          console.error('[RE-ENRICH] Analyzer error:', analyzerError);
        } else {
          // Update analysis with new data
          await supabase
            .from('product_analyses')
            .update({
              analysis_result: analyzerResult,
              enrichment_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', productId);

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
            message: `Le produit "${supplierProduct.name}" a été enrichi avec succès.`,
            related_product_id: productId,
            action_url: `/imported-products?highlight=${productId}`
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
