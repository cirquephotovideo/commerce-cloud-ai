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
      
      // Get current retry count
      const retryCount = job.metadata?.retry_count || 0;
      
      if (retryCount < 3) {
        // Retry this chunk
        console.log(`[CHUNK-PROCESSOR] Retrying chunk (attempt ${retryCount + 1}/3)...`);
        
        await supabaseClient
          .from('import_jobs')
          .update({
            metadata: {
              ...job.metadata,
              retry_count: retryCount + 1,
              last_error: error.message,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', import_job_id);
        
        // Retry after exponential backoff
        const delay = 5000 * Math.pow(2, retryCount);
        console.log(`[CHUNK-PROCESSOR] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry
        await supabaseClient.functions.invoke('process-import-chunk', {
          body: { import_job_id, supplier_id, platform, offset, limit, options }
        });
        
      } else {
        // Max retries reached - mark as failed
        console.error('[CHUNK-PROCESSOR] Max retries reached, marking job as failed');
        await supabaseClient
          .from('import_jobs')
          .update({
            status: 'failed',
            error_message: `Failed after 3 retries: ${error.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', import_job_id);
      }
      
      throw error;
    }

    console.log('[CHUNK-PROCESSOR] Chunk completed:', data);

    // Log chunk complete
    await writeLog(supabaseClient, {
      jobId: import_job_id,
      userId: job.user_id,
      supplierId: supplier_id,
      functionName: 'process-import-chunk',
      step: 'chunk_complete',
      message: `Chunk completed: imported=${data.imported || 0}, matched=${data.matched || 0}, errors=${data.errors || 0}`,
      context: { 
        offset, 
        limit, 
        imported: data.imported || 0,
        matched: data.matched || 0,
        errors: data.errors || 0,
        hasMore: data.hasMore, 
        nextOffset: data.nextOffset 
      }
    });

    // Update job progress
    const currentProgress = offset + (data.imported || 0);
    const chunksCompleted = Math.floor(currentProgress / limit);
    
    console.log('[CHUNK-PROCESSOR] Updating job progress:', {
      currentProgress,
      imported: (job.products_imported || 0) + (data.imported || 0),
      matched: (job.products_matched || 0) + (data.matched || 0),
      errors: (job.products_errors || 0) + (data.errors || 0),
    });
    
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        progress_current: currentProgress,
        products_imported: (job.products_imported || 0) + (data.imported || 0),
        products_matched: (job.products_matched || 0) + (data.matched || 0),
        products_errors: (job.products_errors || 0) + (data.errors || 0),
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
          totalErrors: job.products_errors + (data.errors || 0)
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
