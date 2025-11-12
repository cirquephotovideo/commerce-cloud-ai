import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background processing function
async function processJob(jobId: string, supabase: any) {
  console.log(`[auto-link-products] Starting background processing for job ${jobId}`);
  
  try {
    // Get job details
    const { data: job } = await supabase
      .from('auto_link_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      console.error('[auto-link-products] Job not found:', jobId);
      return;
    }

    // Update job to running
    await supabase
      .from('auto_link_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    let currentOffset = 0;
    let totalLinksCreated = 0;
    const batchSize = job.batch_size;

    // Process in chunks
    while (true) {
      console.log(`[auto-link-products] Processing chunk at offset ${currentOffset}`);
      
      const { data, error } = await supabase
        .rpc('bulk_create_product_links_chunked', {
          p_user_id: job.user_id,
          p_limit: batchSize,
          p_offset: currentOffset
        });

      if (error) {
        console.error('[auto-link-products] RPC error:', error);
        await supabase
          .from('auto_link_jobs')
          .update({ 
            status: 'failed', 
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
        break;
      }

      totalLinksCreated += data[0].links_created;
      currentOffset += data[0].processed_count;

      // Update progress
      await supabase
        .from('auto_link_jobs')
        .update({
          processed_count: currentOffset,
          links_created: totalLinksCreated,
          current_offset: currentOffset
        })
        .eq('id', jobId);

      console.log(`[auto-link-products] Processed ${currentOffset} products, created ${totalLinksCreated} links`);

      // Stop if no more data
      if (!data[0].has_more) {
        await supabase
          .from('auto_link_jobs')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
        console.log(`[auto-link-products] Job completed: ${totalLinksCreated} links created`);
        break;
      }

      // Small pause to avoid overloading
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error: any) {
    console.error('[auto-link-products] Processing error:', error);
    await supabase
      .from('auto_link_jobs')
      .update({ 
        status: 'failed', 
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const { mode = 'start', job_id, batch_size = 100, analysis_id, auto_mode } = body;

    // BACKWARD COMPATIBILITY: Handle old API calls from AnalysesTab and useProductLinks
    if (auto_mode === true || analysis_id) {
      console.log('[auto-link-products] Single product link mode');
      
      const { data, error } = await supabase
        .rpc('bulk_create_product_links_chunked', {
          p_user_id: user.id,
          p_limit: analysis_id ? 1 : 100,
          p_offset: 0
        });

      if (error) {
        console.error('[auto-link-products] Single link error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          links_created: data[0].links_created,
          processed_count: data[0].processed_count
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // MODE 1: START - Create job and start background processing
    if (mode === 'start') {
      console.log('[auto-link-products] Starting new job for user:', user.id);
      
      // Count total products to process
      const { count } = await supabase
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null)
        .neq('ean', '');

      console.log('[auto-link-products] Total products to process:', count);

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('auto_link_jobs')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_to_process: count || 0,
          batch_size: batch_size
        })
        .select()
        .single();

      if (jobError) {
        console.error('[auto-link-products] Error creating job:', jobError);
        throw jobError;
      }

      console.log('[auto-link-products] Created job:', job.id);

      // Start background processing
      EdgeRuntime.waitUntil(processJob(job.id, supabase));

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          total_to_process: count || 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // MODE 2: STATUS - Get job status
    if (mode === 'status') {
      if (!job_id) {
        return new Response(
          JSON.stringify({ error: 'job_id required for status mode' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: job, error: jobError } = await supabase
        .from('auto_link_jobs')
        .select('*')
        .eq('id', job_id)
        .eq('user_id', user.id)
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify(job),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fallback for unknown mode
    return new Response(
      JSON.stringify({ 
        error: 'Invalid mode. Use "start" or "status"' 
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
