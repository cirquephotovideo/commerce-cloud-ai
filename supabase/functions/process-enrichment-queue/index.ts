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

    const { maxItems = 50, parallel = 5 } = await req.json();

    console.log(`[ENRICHMENT-QUEUE] Starting processing (max ${maxItems} items, ${parallel} parallel)`);

    // Fetch pending tasks with priority: EAN-based products first
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
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout per task

    // Process tasks in parallel batches
    const processTask = async (task: any) => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout after 10 minutes')), TIMEOUT_MS)
      );

      const taskPromise = (async () => {
        try {
          console.log(`[ENRICHMENT-QUEUE] Processing task ${task.id} for product ${task.supplier_product_id}`);

          // Update status to processing with timeout timestamp
          const timeoutAt = new Date(Date.now() + TIMEOUT_MS).toISOString();
          await supabase
            .from('enrichment_queue')
            .update({ 
              status: 'processing', 
              started_at: new Date().toISOString(),
              timeout_at: timeoutAt 
            })
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
            ean: supplierProduct.ean,
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
          return { success: true, taskId: task.id };

        } catch (error: any) {
          console.error(`[ENRICHMENT-QUEUE] Error processing task ${task.id}:`, error);
          
          // Check retry count
          const currentRetryCount = task.retry_count || 0;
          const maxRetries = task.max_retries || 2;
          
          if (currentRetryCount < maxRetries) {
            // Mark for retry
            await supabase
              .from('enrichment_queue')
              .update({ 
                status: 'pending',
                retry_count: currentRetryCount + 1,
                last_error: error.message,
                started_at: null,
                timeout_at: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', task.id);
            console.log(`[ENRICHMENT-QUEUE] Task ${task.id} will retry (${currentRetryCount + 1}/${maxRetries})`);
          } else {
            // Mark as failed - max retries reached
            await supabase
              .from('enrichment_queue')
              .update({ 
                status: 'failed', 
                error_message: error.message,
                last_error: error.message,
                completed_at: new Date().toISOString() 
              })
              .eq('id', task.id);
          }

          errorCount++;
          return { success: false, taskId: task.id, error: error.message };
        }
      })();

      // Race between task and timeout
      return Promise.race([taskPromise, timeoutPromise]);
    };

    // Process tasks in parallel batches of N
    for (let i = 0; i < tasks.length; i += parallel) {
      const batch = tasks.slice(i, i + parallel);
      console.log(`[ENRICHMENT-QUEUE] Processing batch ${Math.floor(i / parallel) + 1} (${batch.length} tasks)`);
      
      const results = await Promise.allSettled(batch.map(processTask));
      
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.error(`[ENRICHMENT-QUEUE] Task ${batch[idx].id} rejected:`, result.reason);
        }
      });
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
