// @ts-ignore - Deno edge function compatibility
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STUCK_THRESHOLD_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[SAFETY] Checking for stuck chunks...');

    // Find chunks stuck in processing for more than STUCK_THRESHOLD_MINUTES
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - STUCK_THRESHOLD_MINUTES);

    const { data: stuckChunks, error: fetchError } = await supabaseClient
      .from('code2asin_import_chunks')
      .select('*, code2asin_import_jobs!inner(user_id)')
      .eq('status', 'processing')
      .lt('updated_at', thresholdTime.toISOString());

    if (fetchError) {
      console.error('[SAFETY] Failed to fetch stuck chunks:', fetchError);
      throw new Error('Failed to fetch stuck chunks');
    }

    if (!stuckChunks || stuckChunks.length === 0) {
      console.log('[SAFETY] No stuck chunks found');
      return new Response(
        JSON.stringify({
          success: true,
          restarted: 0,
          message: 'No stuck chunks found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log(`[SAFETY] Found ${stuckChunks.length} stuck chunks`);

    let restartedCount = 0;

    for (const chunk of stuckChunks) {
      try {
        console.log(`[SAFETY] Restarting chunk ${chunk.id} (index ${chunk.chunk_index})`);

        // Reset chunk to pending and increment retry count
        const { error: updateError } = await supabaseClient
          .from('code2asin_import_chunks')
          .update({
            status: 'pending',
            retry_count: (chunk.retry_count || 0) + 1,
            error_message: `Automatically restarted after being stuck for ${STUCK_THRESHOLD_MINUTES} minutes`,
            updated_at: new Date().toISOString()
          })
          .eq('id', chunk.id);

        if (updateError) {
          console.error(`[SAFETY] Failed to update chunk ${chunk.id}:`, updateError);
          continue;
        }

        // Get job details to find file path
        const { data: job } = await supabaseClient
          .from('code2asin_import_jobs')
          .select('filename')
          .eq('id', chunk.job_id)
          .single();

        if (!job) {
          console.error(`[SAFETY] Job not found for chunk ${chunk.id}`);
          continue;
        }

        // Construct file path (assuming same pattern as upload)
        const filePath = `${chunk.code2asin_import_jobs.user_id}/${job.filename}`;

        // Re-invoke process-code2asin-chunk
        const { error: invokeError } = await supabaseClient.functions.invoke(
          'process-code2asin-chunk',
          {
            body: {
              jobId: chunk.job_id,
              chunkId: chunk.id,
              filePath: filePath,
              startRow: chunk.start_row,
              endRow: chunk.end_row
            }
          }
        );

        if (invokeError) {
          console.error(`[SAFETY] Failed to invoke chunk ${chunk.id}:`, invokeError);
          continue;
        }

        restartedCount++;
        console.log(`[SAFETY] Successfully restarted chunk ${chunk.id}`);

      } catch (err) {
        console.error(`[SAFETY] Error restarting chunk ${chunk.id}:`, err);
      }
    }

    console.log(`[SAFETY] Restarted ${restartedCount} out of ${stuckChunks.length} stuck chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        restarted: restartedCount,
        found: stuckChunks.length,
        message: `Restarted ${restartedCount} stuck chunks`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[SAFETY] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
