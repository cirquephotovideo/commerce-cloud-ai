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

    const { maxItems = 10 } = await req.json();

    console.log(`[ENRICHMENT-QUEUE] Starting processing (max ${maxItems} items)`);

    // Fetch pending tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('enrichment_queue')
      .select('*, supplier_products(*)')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(maxItems);

    if (tasksError) throw tasksError;

    console.log(`[ENRICHMENT-QUEUE] Found ${tasks?.length || 0} pending tasks`);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending tasks' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    for (const task of tasks) {
      try {
        console.log(`[ENRICHMENT-QUEUE] Processing task ${task.id} for product ${task.supplier_product_id}`);

        // Update status to processing
        await supabase
          .from('enrichment_queue')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', task.id);

        const supplierProduct = task.supplier_products;
        if (!supplierProduct) {
          throw new Error('Supplier product not found');
        }

        // Call product-analyzer with correct format
        console.log(`[ENRICHMENT-QUEUE] Calling product-analyzer for ${supplierProduct.product_name}`);
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'product-analyzer',
          {
            body: {
              productInput: supplierProduct.product_name || supplierProduct.ean,
              includeImages: task.enrichment_type?.includes('images'),
              additionalData: {
                description: supplierProduct.description,
                ean: supplierProduct.ean,
                brand: supplierProduct.brand,
                category: supplierProduct.category,
                purchase_price: supplierProduct.purchase_price,
                currency: supplierProduct.currency,
                supplier_reference: supplierProduct.supplier_reference,
              }
            }
          }
        );

        if (analysisError) throw analysisError;

        console.log(`[ENRICHMENT-QUEUE] Analysis completed, creating product_analyses entry`);

        // Create product_analyses entry
        const { data: analysis, error: insertError } = await supabase
          .from('product_analyses')
          .insert({
            user_id: task.user_id,
            product_name: supplierProduct.product_name,
            product_ean: supplierProduct.ean,
            purchase_price: supplierProduct.purchase_price,
            analysis_result: analysisData,
            source: 'supplier_enrichment',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        console.log(`[ENRICHMENT-QUEUE] Created analysis ${analysis.id}, linking to supplier product`);

        // Create product_link
        await supabase
          .from('product_links')
          .insert({
            supplier_product_id: task.supplier_product_id,
            analysis_id: analysis.id,
            link_type: 'enrichment',
            confidence_score: 1.0,
            created_by: task.user_id,
          });

        // Update enrichment_queue with analysis_id
        await supabase
          .from('enrichment_queue')
          .update({ analysis_id: analysis.id })
          .eq('id', task.id);

        // Process additional enrichments
        const enrichmentTypes = task.enrichment_type || [];

        for (const type of enrichmentTypes) {
          try {
            console.log(`[ENRICHMENT-QUEUE] Processing enrichment type: ${type}`);

            switch (type) {
              case 'amazon':
                if (supplierProduct.ean) {
                  await supabase.functions.invoke('amazon-product-enrichment', {
                    body: { 
                      analysisId: analysis.id, 
                      ean: supplierProduct.ean 
                    }
                  });
                }
                break;

              case 'images':
                await supabase.functions.invoke('generate-image', {
                  body: { 
                    analysisId: analysis.id,
                    productName: supplierProduct.product_name,
                    description: supplierProduct.description,
                  }
                });
                break;

              case 'video':
                await supabase.functions.invoke('heygen-video-generator', {
                  body: { 
                    analysisId: analysis.id,
                    productData: analysisData,
                  }
                });
                break;

              case 'rsgp':
                await supabase.functions.invoke('rsgp-compliance-generator', {
                  body: { 
                    analysisId: analysis.id,
                    productData: analysisData,
                  }
                });
                break;
            }
          } catch (enrichError) {
            console.error(`[ENRICHMENT-QUEUE] Error in ${type} enrichment:`, enrichError);
            // Continue with other enrichments even if one fails
          }
        }

        // Mark as completed
        await supabase
          .from('enrichment_queue')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', task.id);

        // Create user alert
        await supabase.from('user_alerts').insert({
          user_id: task.user_id,
          alert_type: 'enrichment_complete',
          title: 'Enrichissement terminé',
          message: `Le produit "${supplierProduct.product_name}" a été enrichi avec succès`,
          metadata: {
            supplier_product_id: task.supplier_product_id,
            analysis_id: analysis.id,
          },
        });

        successCount++;
        console.log(`[ENRICHMENT-QUEUE] Task ${task.id} completed successfully`);

      } catch (error: any) {
        console.error(`[ENRICHMENT-QUEUE] Error processing task ${task.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('enrichment_queue')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            completed_at: new Date().toISOString() 
          })
          .eq('id', task.id);

        errorCount++;
      }
    }

    console.log(`[ENRICHMENT-QUEUE] Processing complete: ${successCount} succeeded, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        processed: tasks.length,
        success: successCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ENRICHMENT-QUEUE] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
