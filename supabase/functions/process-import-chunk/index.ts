import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Write log to import_logs table
async function writeLog(supabaseClient: any, params: {
  jobId: string;
  userId: string;
  supplierId?: string;
  functionName: string;
  step: string;
  level?: string;
  message: string;
  context?: any;
}) {
  try {
    await supabaseClient.from('import_logs').insert([{
      job_id: params.jobId,
      user_id: params.userId,
      supplier_id: params.supplierId ?? null,
      function_name: params.functionName,
      step: params.step,
      level: params.level ?? 'info',
      message: params.message,
      context: params.context ?? {}
    }]);
  } catch (err) {
    console.error('[LOG] Failed to write log:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { import_job_id, supplier_id, platform, offset, limit, options } = await req.json();
    
    console.log(`[CHUNK-PROCESSOR] Processing chunk for job ${import_job_id}, offset: ${offset}, limit: ${limit}`);

    // Use service role for background processing
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('import_jobs')
      .select('*')
      .eq('id', import_job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${import_job_id}`);
    }

    // Update job status to 'processing' if it's still 'queued'
    if (job.status === 'queued') {
      await supabaseClient
        .from('import_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', import_job_id);
    }

    // Log chunk start
    await writeLog(supabaseClient, {
      jobId: import_job_id,
      userId: job.user_id,
      supplierId: supplier_id,
      functionName: 'process-import-chunk',
      step: 'chunk_start',
      message: `Processing chunk: offset=${offset}, limit=${limit}`,
      context: { offset, limit, platform }
    });

    // Call import function for this chunk
    console.log(`[CHUNK-PROCESSOR] Invoking import-from-${platform} for chunk...`);
    const { data, error } = await supabaseClient.functions.invoke(
      `import-from-${platform}`,
      {
        body: {
          supplier_id,
          mode: 'import',
          offset,
          limit,
          import_job_id,
          ...options,
        }
      }
    );

    if (error) {
      console.error('[CHUNK-PROCESSOR] Import error:', error);
      
      // Extraire les détails de l'erreur
      let errorDetails: any = { message: error.message };
      try {
        if (error.context?.body) {
          errorDetails = JSON.parse(error.context.body);
        }
      } catch {}
      
      // Get current retry count
      const retryCount = job.metadata?.retry_count || 0;
      
      // ✅ Retry avec backoff exponentiel pour timeouts (5 tentatives au lieu de 3)
      const isTimeoutOrNetworkError = 
        errorDetails.error_code === 'NETWORK_ERROR' || 
        error.message?.includes('timeout') ||
        error.message?.includes('AbortError');
      
      if (retryCount < 5 && isTimeoutOrNetworkError) {
        console.log(`[CHUNK-PROCESSOR] Timeout detected, retrying chunk (attempt ${retryCount + 1}/5)...`);
        
        await supabaseClient
          .from('import_jobs')
          .update({
            metadata: {
              ...job.metadata,
              retry_count: retryCount + 1,
              last_error: errorDetails.message || error.message,
              last_retry_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', import_job_id);
        
        // Backoff exponentiel : 5s, 10s, 20s, 40s, 80s
        const delay = 5000 * Math.pow(2, retryCount);
        console.log(`[CHUNK-PROCESSOR] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry
        await supabaseClient.functions.invoke('process-import-chunk', {
          body: { import_job_id, supplier_id, platform, offset, limit, options }
        });
        
      } else {
        // ✅ Max retries reached - move to Dead Letter Queue
        const failReason = isTimeoutOrNetworkError 
          ? `Failed after 5 timeout retries at offset ${offset}`
          : `Failed after ${retryCount} retries: ${errorDetails.user_message || error.message}`;
        
        console.log(`[CHUNK-PROCESSOR] ⚠️ Moving chunk to DLQ: offset=${offset}`);
        
        // Insert chunk into dead letter queue
        await supabaseClient
          .from('import_dead_letters')
          .insert({
            job_id: import_job_id,
            chunk_data: {
              supplier_id,
              platform,
              offset,
              limit,
              options,
              correlation_id: job.metadata?.correlation_id
            },
            error_details: {
              message: errorDetails.user_message || error.message,
              error_code: errorDetails.error_code,
              stack: error.stack,
              retry_count: retryCount
            },
            retry_count: retryCount,
            max_retries_exceeded: true
          });
        
        await writeLog(supabaseClient, {
          jobId: import_job_id,
          userId: job.user_id,
          supplierId: supplier_id,
          functionName: 'process-import-chunk',
          step: 'dlq_insert',
          level: 'error',
          message: `Chunk moved to DLQ after ${retryCount} retries: ${failReason}`,
          context: { offset, limit, error: errorDetails }
        });
        
        // ✅ IMPORTANT: Don't throw - continue processing remaining chunks
        // Mark progress_current to skip this failed chunk
        const processed = limit; // Count as processed even if failed
        await supabaseClient
          .from('import_jobs')
          .update({
            progress_current: (job.progress_current || 0) + processed,
            products_errors: (job.products_errors || 0) + processed,
            metadata: {
              ...job.metadata,
              has_dlq_entries: true,
              last_dlq_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', import_job_id);
        
        // Return success to continue with next chunk
        return new Response(JSON.stringify({ 
          success: false,
          moved_to_dlq: true,
          chunk: { offset, limit },
          message: failReason
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // ✅ Return 200 to continue processing
        });
      }
    }

    console.log('[CHUNK-PROCESSOR] Chunk completed:', data);

    // Log chunk complete
    await writeLog(supabaseClient, {
      jobId: import_job_id,
      userId: job.user_id,
      supplierId: supplier_id,
      functionName: 'process-import-chunk',
      step: 'chunk_complete',
      message: `Chunk completed: imported=${data.imported || 0}, matched=${data.matched || 0}, errors=${data.errors || 0}, skipped=${data.skipped || 0}`,
      context: { 
        offset, 
        limit, 
        imported: data.imported || 0,
        matched: data.matched || 0,
        errors: data.errors || 0,
        skipped: data.skipped || 0,
        hasMore: data.hasMore, 
        nextOffset: data.nextOffset 
      }
    });

    // Update job progress - correct calculation: processed = imported + errors + skipped
    const processed = (data.imported || 0) + (data.errors || 0) + (data.skipped || 0);
    const currentProgress = (job.progress_current || 0) + processed;
    const chunksCompleted = Math.floor(currentProgress / limit);
    
    console.log('[CHUNK-PROCESSOR] Updating job progress:', {
      currentProgress,
      processed,
      imported: (job.products_imported || 0) + (data.imported || 0),
      matched: (job.products_matched || 0) + (data.matched || 0),
      errors: (job.products_errors || 0) + (data.errors || 0),
      skipped: (job.products_skipped || 0) + (data.skipped || 0),
    });
    
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        progress_current: currentProgress,
        products_imported: (job.products_imported || 0) + (data.imported || 0),
        products_matched: (job.products_matched || 0) + (data.matched || 0),
        products_errors: (job.products_errors || 0) + (data.errors || 0),
        products_skipped: (job.products_skipped || 0) + (data.skipped || 0),
        metadata: {
          ...job.metadata,
          chunks_completed: chunksCompleted,
          last_offset: offset + limit,
          last_chunk_completed: new Date().toISOString(),
          retry_count: 0, // Reset on success
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', import_job_id);
    
    if (updateError) {
      console.error('[CHUNK-PROCESSOR] Failed to update job progress:', updateError);
      throw new Error(`Failed to update job progress: ${updateError.message}`);
    }
    
    console.log('[CHUNK-PROCESSOR] Job progress updated successfully');

    // Check if job is paused before continuing
    const { data: currentJob } = await supabaseClient
      .from('import_jobs')
      .select('status')
      .eq('id', import_job_id)
      .single();

    if (currentJob?.status === 'paused') {
      console.log('[CHUNK-PROCESSOR] Job paused, stopping chunk processing');
      
      await writeLog(supabaseClient, {
        jobId: import_job_id,
        userId: job.user_id,
        supplierId: supplier_id,
        functionName: 'process-import-chunk',
        step: 'job_paused',
        message: 'Job paused by user',
        context: { pausedAt: new Date().toISOString() }
      });
      
      return new Response(
        JSON.stringify({ success: true, message: 'Job paused', paused: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if more chunks needed
    if (data.hasMore) {
      console.log('[CHUNK-PROCESSOR] More chunks to process, triggering next chunk...');
      
      // Log next chunk dispatch
      await writeLog(supabaseClient, {
        jobId: import_job_id,
        userId: job.user_id,
        supplierId: supplier_id,
        functionName: 'process-import-chunk',
        step: 'next_chunk_dispatched',
        message: `Dispatched next chunk: offset=${data.nextOffset}, limit=${limit}`,
        context: { nextOffset: data.nextOffset, limit }
      });
      
      // ✅ Attendre 2 secondes avant de dispatcher le prochain chunk pour éviter surcharge API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Trigger next chunk (don't await - let it run in background)
      supabaseClient.functions.invoke('process-import-chunk', {
        body: {
          import_job_id,
          supplier_id,
          platform,
          offset: data.nextOffset,
          limit,
          options,
        }
      }).catch(err => {
        console.error('[CHUNK-PROCESSOR] Failed to trigger next chunk:', err);
      });
      
    } else {
      // All chunks completed
      console.log('[CHUNK-PROCESSOR] All chunks completed, marking job as completed');
      
      // Log completion
      await writeLog(supabaseClient, {
        jobId: import_job_id,
        userId: job.user_id,
        supplierId: supplier_id,
        functionName: 'process-import-chunk',
        step: 'all_chunks_completed',
        message: `Import completed successfully`,
        context: { 
          totalImported: job.products_imported + (data.imported || 0),
          totalMatched: job.products_matched + (data.matched || 0),
          totalErrors: job.products_errors + (data.errors || 0),
          totalSkipped: job.products_skipped + (data.skipped || 0)
        }
      });
      await supabaseClient
        .from('import_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', import_job_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Chunk processed successfully',
        hasMore: data.hasMore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CHUNK-PROCESSOR] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
