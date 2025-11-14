// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
}

const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelayMs: 5000, // 5 seconds
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log(`[RETRY-CHUNKS] Looking for failed chunks in job ${jobId}`);
    
    // Get failed chunks
    const { data: failedChunks, error: fetchError } = await supabaseClient
      .from('code2asin_import_chunks')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'failed');
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!failedChunks || failedChunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Aucun chunk échoué à relancer',
          retriedCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[RETRY-CHUNKS] Found ${failedChunks.length} failed chunks`);
    
    // Get job details
    const { data: job, error: jobError } = await supabaseClient
      .from('code2asin_import_jobs')
      .select('filename')
      .eq('id', jobId)
      .single();
    
    if (jobError || !job) {
      throw new Error('Job not found');
    }
    
    const filePath = `code2asin/${job.filename}`;
    
    // Retry chunks with exponential backoff
    const retryPromises = failedChunks.map(async (chunk, index) => {
      const retryCount = (chunk.retry_count || 0) + 1;
      
      if (retryCount > RETRY_CONFIG.maxRetries) {
        console.log(`[RETRY-CHUNKS] Chunk ${chunk.id} exceeded max retries, skipping`);
        return { chunkId: chunk.id, success: false, reason: 'max_retries_exceeded' };
      }
      
      // Calculate backoff delay
      const delayMs = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount - 1);
      
      // Stagger retries to avoid overwhelming the system
      const staggerDelayMs = index * 2000; // 2 seconds between each chunk
      await new Promise(resolve => setTimeout(resolve, staggerDelayMs));
      
      try {
        // Mark chunk as pending with retry metadata
        await supabaseClient
          .from('code2asin_import_chunks')
          .update({ 
            status: 'pending',
            retry_count: retryCount,
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', chunk.id);
        
        console.log(`[RETRY-CHUNKS] Chunk ${chunk.id} marked for retry (attempt ${retryCount}/${RETRY_CONFIG.maxRetries})`);
        
        // Wait for backoff delay before invoking
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Invoke chunk processor
        const { error: invokeError } = await supabaseClient.functions.invoke(
          'process-code2asin-chunk',
          {
            body: {
              jobId,
              chunkId: chunk.id,
              filePath,
              startRow: chunk.start_row,
              endRow: chunk.end_row
            }
          }
        );
        
        if (invokeError) {
          console.error(`[RETRY-CHUNKS] Chunk ${chunk.id} invoke failed:`, invokeError);
          
          await supabaseClient
            .from('code2asin_import_chunks')
            .update({ 
              status: 'failed',
              error_message: `Retry ${retryCount} failed: ${invokeError.message}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', chunk.id);
          
          return { chunkId: chunk.id, success: false, reason: 'invoke_error' };
        }
        
        console.log(`[RETRY-CHUNKS] Chunk ${chunk.id} retry initiated successfully`);
        return { chunkId: chunk.id, success: true };
        
      } catch (error) {
        console.error(`[RETRY-CHUNKS] Error retrying chunk ${chunk.id}:`, error);
        
        await supabaseClient
          .from('code2asin_import_chunks')
          .update({ 
            status: 'failed',
            error_message: `Retry ${retryCount} error: ${error instanceof Error ? error.message : String(error)}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', chunk.id);
        
        return { chunkId: chunk.id, success: false, reason: 'exception' };
      }
    });
    
    const results = await Promise.all(retryPromises);
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[RETRY-CHUNKS] Retry completed: ${successCount} success, ${failedCount} failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        retriedCount: successCount,
        failedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[RETRY-CHUNKS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
