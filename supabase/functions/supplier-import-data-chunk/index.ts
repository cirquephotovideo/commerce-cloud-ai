import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportChunkRequest {
  jobId: string;
  chunkIndex: number;
  chunkData: any[][];
  columnMapping: Record<string, number | null>;
  supplierId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user using proper method
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[DATA-CHUNK] Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[DATA-CHUNK] Auth error:', authError?.message || 'No user found', {
        hasToken: !!token,
        tokenLength: token?.length,
        errorDetails: authError
      });
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`);
    }

    const { jobId, chunkIndex, chunkData, columnMapping, supplierId }: ImportChunkRequest = await req.json();

    console.log('[DATA-CHUNK] Processing:', { jobId, chunkIndex, rowCount: chunkData.length, userId: user.id });

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('supplier_import_chunk_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found or unauthorized');
    }

    if (job.status !== 'processing') {
      throw new Error('Job is not in processing state');
    }

    // Process rows
    let matched = 0;
    let newProducts = 0;
    let failed = 0;

    for (const row of chunkData) {
      try {
        // Extract values using column mapping
        const ean = columnMapping.ean !== null ? row[columnMapping.ean] : null;
        const product_name = columnMapping.product_name !== null ? row[columnMapping.product_name] : null;
        const purchase_price = columnMapping.purchase_price !== null ? parseFloat(row[columnMapping.purchase_price]) : null;
        const description = columnMapping.description !== null ? row[columnMapping.description] : null;
        const supplier_reference = columnMapping.supplier_reference !== null ? row[columnMapping.supplier_reference] : null;
        const stock_quantity = columnMapping.stock_quantity !== null ? parseInt(row[columnMapping.stock_quantity]) : null;

        if (!ean && !supplier_reference) {
          console.error('[DATA-CHUNK] Row skipped: no EAN or reference', { row });
          failed++;
          continue;
        }

        // Check if product exists
        let query = supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('user_id', user.id);

        if (ean) {
          query = query.eq('ean', ean);
        } else if (supplier_reference) {
          query = query.eq('supplier_reference', supplier_reference);
        }

        const { data: existing } = await query.single();

        if (existing) {
          // Update existing product
          const { error: updateError } = await supabase
            .from('supplier_products')
            .update({
              product_name: product_name || undefined,
              purchase_price: purchase_price || undefined,
              description: description || undefined,
              stock_quantity: stock_quantity || undefined,
              last_updated: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('[DATA-CHUNK] Update error:', updateError, { ean, product_name });
            failed++;
          } else {
            matched++;
          }
        } else {
          // Insert new product
          const { error: insertError } = await supabase
            .from('supplier_products')
            .insert({
              supplier_id: supplierId,
              user_id: user.id,
              ean: ean || null,
              product_name: product_name || 'Unknown',
              purchase_price: purchase_price || 0,
              description: description || null,
              supplier_reference: supplier_reference || null,
              stock_quantity: stock_quantity || 0,
              enrichment_status: 'pending',
            });

          if (insertError) {
            console.error('[DATA-CHUNK] Insert error:', insertError, { ean, product_name, supplier_reference });
            failed++;
          } else {
            newProducts++;
          }
        }
      } catch (rowError) {
        console.error('[DATA-CHUNK] Row processing error:', rowError);
        failed++;
      }
    }

    // Update job progress
    const processedRows = job.processed_rows + chunkData.length;
    const isComplete = processedRows >= job.total_rows;

    const { error: updateError } = await supabase
      .from('supplier_import_chunk_jobs')
      .update({
        processed_rows: processedRows,
        current_chunk: chunkIndex + 1,
        matched: job.matched + matched,
        new_products: job.new_products + newProducts,
        failed: job.failed + failed,
        status: isComplete ? 'completed' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[DATA-CHUNK] Failed to update job:', updateError);
    }

    // Update supplier last_sync_at if complete
    if (isComplete) {
      await supabase
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplierId);

      // Log import
      await supabase
        .from('supplier_import_logs')
        .insert({
          supplier_id: supplierId,
          user_id: user.id,
          file_name: job.file_path.split('/').pop(),
          total_rows: job.total_rows,
          matched_products: job.matched + matched,
          new_products: job.new_products + newProducts,
          failed_products: job.failed + failed,
          import_status: 'completed',
        });

      console.log('[DATA-CHUNK] Import completed:', {
        total: job.total_rows,
        matched: job.matched + matched,
        new: job.new_products + newProducts,
        failed: job.failed + failed,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunkIndex,
        processed: chunkData.length,
        totalProcessed: processedRows,
        total: job.total_rows,
        isComplete,
        stats: {
          matched: job.matched + matched,
          new: job.new_products + newProducts,
          failed: job.failed + failed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DATA-CHUNK] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
