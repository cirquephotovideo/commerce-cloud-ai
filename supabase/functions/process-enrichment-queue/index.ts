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

    // Handle empty body gracefully
    let maxItems = 50;
    let parallel = 5;
    try {
      const body = await req.json();
      maxItems = body.maxItems || 50;
      parallel = body.parallel || 5;
    } catch (e) {
      console.log('[ENRICHMENT-QUEUE] No body provided, using defaults');
    }

    console.log(`[ENRICHMENT-QUEUE] Starting processing (max ${maxItems} items, ${parallel} parallel)`);

    // Nettoyer les tâches bloquées (> 10 minutes)
    const { error: cleanupError } = await supabase
      .from('enrichment_queue')
      .update({
        status: 'failed',
        error_message: 'Timeout: task blocked for > 10 minutes',
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'processing')
      .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (cleanupError) {
      console.error('[CLEANUP] Error cleaning stuck tasks:', cleanupError);
    } else {
      console.log('[CLEANUP] Cleaned up stuck tasks');
    }

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

    // Phase 1: Charger les préférences Ollama de l'utilisateur
    let ollamaPreferences = { 
      preferredModel: 'gpt-oss:20b-cloud', 
      webSearchEnabled: false 
    };

    if (tasks.length > 0 && tasks[0].user_id) {
      const { data: ollamaConfig } = await supabase
        .from('ollama_configurations')
        .select('default_model, web_search_enabled')
        .eq('user_id', tasks[0].user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (ollamaConfig) {
        ollamaPreferences = {
          preferredModel: ollamaConfig.default_model || 'gpt-oss:20b-cloud',
          webSearchEnabled: ollamaConfig.web_search_enabled || false
        };
        console.log('[ENRICHMENT-QUEUE] Loaded Ollama preferences:', ollamaPreferences);
      }
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

        // Create product_analyses entry with correct schema
        const insertPayload = {
          user_id: task.user_id,
          analysis_result: analysisData || {},
          product_url: supplierProduct.supplier_url || `about:blank#supplier_product:${task.supplier_product_id}`,
          ean: supplierProduct.ean,
          purchase_price: supplierProduct.purchase_price,
          supplier_product_id: task.supplier_product_id,
          description_long: supplierProduct.description
        };
        
        console.log('[ENRICHMENT-QUEUE] Insert payload prepared');

        // Create product_analyses entry
        const { data: analysis, error: insertError } = await supabase
          .from('product_analyses')
          .insert(insertPayload)
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

        // Phase 6: Logs de débogage
        console.log('[ENRICHMENT-QUEUE] Using Ollama preferences:', {
          model: ollamaPreferences.preferredModel,
          webSearch: ollamaPreferences.webSearchEnabled
        });

        // Phase 3: Process additional enrichments EN PARALLÈLE
        const enrichmentTypes = task.enrichment_type || [];
        console.log('[ENRICHMENT-QUEUE] Enrichment types to process:', enrichmentTypes);

        // Créer un tableau de promesses pour tous les enrichissements
        const enrichmentPromises = enrichmentTypes.map(async (type) => {
          try {
            console.log(`[ENRICHMENT-QUEUE] Processing enrichment type: ${type}`);

            switch (type) {
              case 'amazon':
                if (supplierProduct.ean || supplierProduct.product_name) {
                  console.log('[ENRICHMENT-QUEUE] Using Amazon MCP for enrichment');
                  
                  // Utiliser le MCP Amazon au lieu de amazon-product-enrichment
                  const { data: mcpResult, error: mcpError } = await supabase.functions.invoke('mcp-proxy', {
                    body: {
                      packageId: 'amazon-seller-mcp',
                      toolName: 'search_catalog',
                      args: { 
                        keywords: supplierProduct.ean || supplierProduct.product_name 
                      }
                    }
                  });
                  
                  if (mcpError) {
                    console.error('[ENRICHMENT-QUEUE] MCP Amazon error:', mcpError);
                  } else if (mcpResult?.success && mcpResult?.data?.items?.length > 0) {
                    const amazonItem = mcpResult.data.items[0];
                    console.log(`[ENRICHMENT-QUEUE] Found Amazon product: ${amazonItem.asin}`);
                    
                    // Insérer dans amazon_product_data
                    try {
                      await supabase.from('amazon_product_data').upsert({
                        analysis_id: analysis.id,
                        user_id: task.user_id,
                        asin: amazonItem.asin,
                        title: amazonItem.summaries?.[0]?.itemName,
                        ean: supplierProduct.ean,
                        brand: amazonItem.summaries?.[0]?.brand,
                        manufacturer: amazonItem.summaries?.[0]?.manufacturer,
                        product_type: amazonItem.productTypes?.[0],
                        images: amazonItem.images || [],
                        sales_rank: amazonItem.salesRanks?.[0],
                        buy_box_price: amazonItem.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.amount,
                        list_price: amazonItem.summaries?.[0]?.listPrice?.amount,
                        marketplace: mcpResult.data.marketplaceId || 'A13V1IB3VIYZZH',
                        raw_data: amazonItem
                      });
                      console.log('[ENRICHMENT-QUEUE] Amazon data saved successfully');
                    } catch (upsertError) {
                      console.error('[ENRICHMENT-QUEUE] Error saving Amazon data:', upsertError);
                    }
                  }
                }
                break;

              case 'images':
              case 'ai_images':
                return supabase.functions.invoke('generate-image', {
                  body: { 
                    analysisId: analysis.id,
                    productName: supplierProduct.product_name,
                    description: supplierProduct.description,
                  }
                });

              case 'specifications':
                console.log('[ENRICHMENT-QUEUE] Generating specifications');
                return supabase.functions.invoke('enrich-specifications', {
                  body: { 
                    analysisId: analysis.id,
                    productData: supplierProduct,
                    preferred_model: ollamaPreferences.preferredModel,
                    web_search_enabled: ollamaPreferences.webSearchEnabled
                  }
                });

              case 'cost_analysis':
                console.log('[ENRICHMENT-QUEUE] Generating cost analysis');
                return supabase.functions.invoke('enrich-cost-analysis', {
                  body: { 
                    analysisId: analysis.id,
                    productData: supplierProduct,
                    purchasePrice: supplierProduct?.purchase_price,
                    preferred_model: ollamaPreferences.preferredModel,
                    web_search_enabled: ollamaPreferences.webSearchEnabled
                  }
                });

              case 'technical_description':
                console.log('[ENRICHMENT-QUEUE] Generating technical description');
                return supabase.functions.invoke('enrich-technical-description', {
                  body: { 
                    analysisId: analysis.id,
                    productData: supplierProduct,
                    preferred_model: ollamaPreferences.preferredModel,
                    web_search_enabled: ollamaPreferences.webSearchEnabled
                  }
                });

              case 'video':
                return supabase.functions.invoke('heygen-video-generator', {
                  body: { 
                    analysisId: analysis.id,
                    productData: analysisData,
                  }
                });

              case 'rsgp':
                console.log('[ENRICHMENT-QUEUE] Generating RSGP compliance');
                return supabase.functions.invoke('rsgp-compliance-generator', {
                  body: { 
                    analysis_id: analysis.id,
                    productData: analysisData,
                    preferred_model: ollamaPreferences.preferredModel,
                    web_search_enabled: ollamaPreferences.webSearchEnabled
                  }
                });

              case 'odoo_attributes':
                console.log('[ENRICHMENT-QUEUE] Enriching Odoo attributes');
                return supabase.functions.invoke('enrich-odoo-attributes', {
                  body: { 
                    analysisId: analysis.id,
                    provider: 'lovable',
                    preferred_model: ollamaPreferences.preferredModel,
                    webSearchEnabled: ollamaPreferences.webSearchEnabled
                  }
                });
            }
          } catch (enrichError) {
            console.error(`[ENRICHMENT-QUEUE] Error in ${type} enrichment:`, enrichError);
            return { error: enrichError };
          }
        });

        // Exécuter TOUS les enrichissements en parallèle
        console.log(`[ENRICHMENT-QUEUE] Launching ${enrichmentPromises.length} enrichments in parallel`);
        const enrichmentResults = await Promise.allSettled(enrichmentPromises);

        // Logger les résultats
        enrichmentResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            console.log(`[ENRICHMENT-QUEUE] ✅ Enrichment ${enrichmentTypes[idx]} completed`);
          } else {
            console.error(`[ENRICHMENT-QUEUE] ❌ Enrichment ${enrichmentTypes[idx]} failed:`, result.reason);
          }
        });

        // Mark as completed
        await supabase
          .from('enrichment_queue')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', task.id);

        // Update supplier_product status to completed
        if (task.supplier_product_id) {
          await supabase
            .from('supplier_products')
            .update({
              enrichment_status: 'completed',
              enrichment_progress: 100
            })
            .eq('id', task.supplier_product_id);
          console.log(`[ENRICHMENT-QUEUE] Marked supplier_product ${task.supplier_product_id} as completed`);
        }

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
