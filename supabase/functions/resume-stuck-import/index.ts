import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { jobId } = await req.json();

    console.log('[RESUME-IMPORT] Starting resume for job:', jobId);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('supplier_import_chunk_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found or unauthorized');
    }

    // Check if job is resumable
    if (!['processing', 'stalled', 'error'].includes(job.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot resume job with status: ${job.status}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark job as processing
    await supabase
      .from('supplier_import_chunk_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log('[RESUME-IMPORT] Job marked as processing, current_chunk:', job.current_chunk);

    // Return job info so UI can continue from where it stopped
    return new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          current_chunk: job.current_chunk || 0,
          total_chunks: Math.ceil(job.total_rows / job.chunk_size),
          file_path: job.file_path,
          supplier_id: job.supplier_id,
          processed_rows: job.processed_rows || 0,
          total_rows: job.total_rows,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[RESUME-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
