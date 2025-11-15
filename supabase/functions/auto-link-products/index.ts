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
    let lastId: string | null = null;
    // Process in chunks
    while (true) {
      console.log(`[auto-link-products] Processing chunk at offset ${currentOffset}`);
      
      const rpcRes = await supabase
        .rpc('bulk_create_product_links_cursor', {
          p_user_id: job.user_id,
          p_limit: batchSize,
          p_after: lastId
        });
      const data = rpcRes.data as any;
      const error = rpcRes.error as any;

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

      totalLinksCreated += data?.[0]?.links_created ?? 0;
      currentOffset += data?.[0]?.processed_count ?? 0;
      lastId = data?.[0]?.last_id ?? lastId;
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

    // Create client with anon key for JWT verification
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify the JWT by passing it directly to getUser()
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('[auto-link-products] Auth error:', userError || 'No user found');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        details: userError ? String(userError) : 'Invalid or expired token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { mode, job_id, batch_size = 100, analysis_id, auto_mode } = body;

    console.log('[auto-link-products] Request params:', { mode, auto_mode, analysis_id, job_id });

    // BACKWARD COMPATIBILITY: Handle old API calls (no mode specified)
    if (!mode || auto_mode === true || analysis_id) {
      console.log('[auto-link-products] Single product link mode (backward compatibility)');
      
      const { data, error } = await supabaseAdmin
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
      const { count } = await supabaseAdmin
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null)
        .neq('ean', '');

      console.log('[auto-link-products] Total products to process:', count);

      // Create job record
      const { data: job, error: jobError } = await supabaseAdmin
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
      // Start background processing with safe guard for environments without EdgeRuntime
      try {
        // @ts-ignore - EdgeRuntime is provided in the Edge environment
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(processJob(job.id, supabaseAdmin));
        } else {
          // Fallback: fire-and-forget
          // no-await to avoid blocking the response
          void processJob(job.id, supabaseAdmin);
        }
      } catch (_) {
        void processJob(job.id, supabaseAdmin);
      }

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

      const { data: job, error: jobError } = await supabaseAdmin
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

    // Invalid mode - log and return error
    console.error('[auto-link-products] Invalid mode:', mode);
    return new Response(
      JSON.stringify({ 
        error: 'Invalid mode. Use "start", "status", or omit mode for single product linking',
        received_params: { mode, auto_mode, analysis_id }
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
