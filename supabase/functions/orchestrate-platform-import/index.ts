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
    const { platform, supplier_id, options } = await req.json();
    
    console.log('[ORCHESTRATE] Starting orchestration for platform:', platform, 'supplier:', supplier_id);

    // Get user authentication
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    const userId = user.id;

    // PHASE 1: Get total product count
    console.log('[ORCHESTRATE] Phase 1: Getting product count...');
    const { data: countData, error: countError } = await supabaseClient.functions.invoke(
      `import-from-${platform}`,
      { 
        body: { 
          supplier_id, 
          mode: 'count' 
        } 
      }
    );

    if (countError) throw countError;
    
    const totalProducts = countData?.total_products || 0;
    console.log('[ORCHESTRATE] Total products to import:', totalProducts);

    if (totalProducts === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No products found to import' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // PHASE 2: Create import job record
    const chunkSize = 50; // Reduced to 50 to handle large image data without timeout
    const totalChunks = Math.ceil(totalProducts / chunkSize);
    
    console.log('[ORCHESTRATE] Phase 2: Creating import job record...');
    const { data: job, error: jobError } = await supabaseClient
      .from('import_jobs')
      .insert({
        user_id: userId,
        supplier_id: supplier_id,
        status: 'queued',
        progress_current: 0,
        progress_total: totalProducts,
        metadata: {
          platform,
          chunk_size: chunkSize,
          chunks_total: totalChunks,
          chunks_completed: 0,
          options,
          started_at: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log('[ORCHESTRATE] Job created with ID:', job.id);

    // Log job creation
    await writeLog(supabaseClient, {
      jobId: job.id,
      userId,
      supplierId: supplier_id,
      functionName: 'orchestrate-platform-import',
      step: 'job_created',
      message: `Import started in background: ${totalProducts} products in ${totalChunks} chunks (chunk_size=${chunkSize})`,
      context: { totalProducts, totalChunks, chunkSize, platform, options }
    });

    // PHASE 3: Enqueue first chunk (non-blocking)
    console.log('[ORCHESTRATE] Phase 3: Starting first chunk...');
    
    // Log first chunk dispatch
    await writeLog(supabaseClient, {
      jobId: job.id,
      userId,
      supplierId: supplier_id,
      functionName: 'orchestrate-platform-import',
      step: 'first_chunk_dispatched',
      message: `Dispatched first chunk: offset=0, limit=${chunkSize}`,
      context: { offset: 0, limit: chunkSize }
    });
    
    // Start first chunk in background - don't await
    supabaseClient.functions.invoke('process-import-chunk', {
      body: {
        import_job_id: job.id,
        supplier_id,
        platform,
        offset: 0,
        limit: chunkSize,
        options,
      }
    }).catch(err => {
      console.error('[ORCHESTRATE] Failed to start first chunk:', err);
    });

    // PHASE 4: Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        import_job_id: job.id,
        total_products: totalProducts,
        estimated_chunks: totalChunks,
        chunk_size: chunkSize,
        message: `Import started in background (${totalChunks} chunks)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ORCHESTRATE] Error:', error);
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
