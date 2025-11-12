import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[auto-link-products] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('[auto-link-products] Auth error:', userError?.message || 'No user found');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        details: userError?.message || 'Invalid or expired token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[auto-link-products] Authenticated user:', user.id);

    const { auto_mode = false, batch_size = 50 } = await req.json();

    // MODE GLOBAL OPTIMISÉ: Process in batches to avoid timeout
    if (auto_mode) {
      console.log('[auto-link-products] Starting batch processing with batch_size:', batch_size);
      
      let totalLinksCreated = 0;
      let processedBatches = 0;
      const BATCH_SIZE = batch_size;

      // Process in batches until no more links are created
      while (true) {
        const batchStartTime = Date.now();
        
        // Fetch products that need linking (limited batch)
        const { data: analyses, error: fetchError } = await supabase
          .from('product_analyses')
          .select('id, ean, product_name')
          .eq('user_id', user.id)
          .not('ean', 'is', null)
          .neq('ean', '')
          .limit(BATCH_SIZE);

        if (fetchError) {
          console.error('[auto-link-products] Fetch error:', fetchError);
          throw fetchError;
        }

        if (!analyses || analyses.length === 0) {
          console.log('[auto-link-products] No more products to process');
          break;
        }

        console.log(`[auto-link-products] Processing batch ${processedBatches + 1}: ${analyses.length} products`);

        // Process each product in this batch
        let batchLinksCreated = 0;
        for (const analysis of analyses) {
          // Find matching supplier products by EAN
          const { data: suppliers, error: supplierError } = await supabase
            .from('supplier_products')
            .select('id')
            .eq('user_id', user.id)
            .eq('ean', analysis.ean)
            .limit(1);

          if (supplierError) {
            console.error(`[auto-link-products] Error finding supplier for ${analysis.ean}:`, supplierError);
            continue;
          }

          if (suppliers && suppliers.length > 0) {
            // Check if link already exists
            const { data: existingLink } = await supabase
              .from('product_links')
              .select('id')
              .eq('analysis_id', analysis.id)
              .eq('supplier_product_id', suppliers[0].id)
              .single();

            if (!existingLink) {
              // Create the link
              const { error: insertError } = await supabase
                .from('product_links')
                .insert({
                  analysis_id: analysis.id,
                  supplier_product_id: suppliers[0].id,
                  link_type: 'automatic',
                  confidence_score: 100,
                  user_id: user.id
                });

              if (!insertError) {
                batchLinksCreated++;
              } else {
                console.error(`[auto-link-products] Insert error for ${analysis.id}:`, insertError);
              }
            }
          }
        }

        totalLinksCreated += batchLinksCreated;
        processedBatches++;
        const batchTime = Date.now() - batchStartTime;
        
        console.log(`[auto-link-products] Batch ${processedBatches} completed: ${batchLinksCreated} links created in ${batchTime}ms`);

        // Stop if we processed fewer items than batch size (last batch)
        if (analyses.length < BATCH_SIZE) {
          break;
        }

        // Stop after a reasonable number of batches to prevent infinite loops
        if (processedBatches >= 20) {
          console.log('[auto-link-products] Max batches reached, stopping');
          break;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log(`[auto-link-products] All batches completed: ${totalLinksCreated} total links created in ${executionTime}ms`);

      return new Response(
        JSON.stringify({
          links_created: totalLinksCreated,
          batches_processed: processedBatches,
          execution_time_ms: executionTime,
          mode: 'batch_processing',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fallback: mode non-optimisé (pour compatibilité)
    return new Response(
      JSON.stringify({ 
        error: 'Mode non supporté. Utilisez auto_mode=true pour la fusion batch.' 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[auto-link-products] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
