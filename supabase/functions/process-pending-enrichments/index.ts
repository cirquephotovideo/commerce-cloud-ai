import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Starting pending enrichments processing...');

    // Get pending products (max 10 at a time)
    const { data: pendingProducts, error: fetchError } = await supabaseClient
      .from('supplier_products')
      .select('*')
      .eq('enrichment_status', 'pending')
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingProducts || pendingProducts.length === 0) {
      console.log('✅ No pending products to enrich');
      return new Response(JSON.stringify({ message: 'No pending products' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📦 Found ${pendingProducts.length} products to enrich`);

    let enriched = 0;
    let errors = 0;

    for (const product of pendingProducts) {
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      
      while (retries < maxRetries && !success) {
        try {
          console.log(`🔍 Enriching product (attempt ${retries + 1}/${maxRetries}): "${product.product_name}" (${product.id})`);

          // Update status to enriching
          await supabaseClient
            .from('supplier_products')
            .update({ 
              enrichment_status: 'enriching',
              enrichment_progress: 10
            })
            .eq('id', product.id);

          // Call product analyzer
          const analyzerResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/product-analyzer`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                productInput: product.product_name || product.ean,
                includeImages: true,
              })
            }
          );

          await supabaseClient
            .from('supplier_products')
            .update({ enrichment_progress: 60 })
            .eq('id', product.id);

          if (!analyzerResponse.ok) {
            let errorMessage = 'Enrichment failed';
            let structuredError = null;
            
            try {
              const errorBody = await analyzerResponse.json();
              
              // Parse structured error from product-analyzer
              if (errorBody.success === false && errorBody.code) {
                structuredError = {
                  code: errorBody.code,
                  http_status: errorBody.http_status,
                  provider: errorBody.provider,
                  message: errorBody.message
                };
                errorMessage = `[${errorBody.code}] ${errorBody.message}`;
                if (errorBody.provider) errorMessage += ` (provider: ${errorBody.provider})`;
              } else {
                errorMessage = errorBody?.error?.message || errorBody?.error || errorMessage;
              }
              
              console.error(`❌ Analyzer error for ${product.id} (attempt ${retries + 1}):`, structuredError || errorBody);
            } catch {
              errorMessage = `HTTP ${analyzerResponse.status}: ${await analyzerResponse.text()}`;
            }
            
            // Store structured error for better debugging
            const error = new Error(errorMessage);
            (error as any).structuredError = structuredError;
            throw error;
          }

          const enrichmentData = await analyzerResponse.json();

          // Support des 2 formats (ancien flat + nouveau wrapped)
          const analysisData = enrichmentData.success 
            ? enrichmentData.analysis 
            : enrichmentData;

          if (!analysisData?.product_name) {
            throw new Error('Invalid enrichment data structure');
          }

          // Create product_analyses
          const { data: newAnalysis, error: insertError } = await supabaseClient
            .from('product_analyses')
            .insert({
              user_id: product.user_id,
              product_url: product.product_name,
              analysis_result: analysisData,
              image_urls: analysisData.imageUrls || enrichmentData.imageUrls || [],
              ean: product.ean,
              purchase_price: product.purchase_price,
              purchase_currency: product.currency,
              supplier_product_id: product.id,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Amazon enrichment if EAN available
          if (product.ean && newAnalysis?.id) {
            await supabaseClient.functions.invoke('amazon-product-enrichment', {
              body: { 
                analysis_id: newAnalysis.id,
                ean: product.ean
              }
            }).catch(err => console.error('Amazon enrichment error:', err));
          }

          // Mark as completed
          await supabaseClient
            .from('supplier_products')
            .update({ 
              enrichment_status: 'completed',
              enrichment_progress: 100
            })
            .eq('id', product.id);

          console.log(`✅ Successfully enriched ${product.product_name}`);
          enriched++;
          success = true;

        } catch (error) {
        retries++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const structuredError = (error as any)?.structuredError;
        
        console.error(`❌ Error enriching ${product.id} (attempt ${retries}/${maxRetries}):`, {
          message: errorMessage,
          structured: structuredError
        });
        
        if (retries < maxRetries) {
          // Backoff exponentiel avec jitter : 2s±20%, 4s±20%, 8s±20%
          const baseWaitTime = Math.pow(2, retries) * 1000;
          const jitter = baseWaitTime * 0.2 * (Math.random() - 0.5); // ±20% jitter
          const waitTime = Math.floor(baseWaitTime + jitter);
          console.log(`⏳ Waiting ${waitTime}ms before retry (base: ${baseWaitTime}ms)...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Dernier retry échoué - store detailed error
          console.error(`❌ All retries failed for ${product.id}`);
          
          let finalErrorMessage = errorMessage;
          if (structuredError) {
            finalErrorMessage = JSON.stringify({
              message: errorMessage,
              code: structuredError.code,
              provider: structuredError.provider,
              http_status: structuredError.http_status
            });
          }
          
          await supabaseClient
            .from('supplier_products')
            .update({ 
              enrichment_status: 'failed',
              enrichment_progress: 0,
              error_message: finalErrorMessage
            })
            .eq('id', product.id);
          errors++;
        }
      }
      } // Ferme le while loop
    } // Ferme le for loop

    console.log(`🎯 Processing complete: ${enriched} enriched, ${errors} errors`);

    return new Response(JSON.stringify({ 
      success: true,
      enriched, 
      errors,
      total: pendingProducts.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Global error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
