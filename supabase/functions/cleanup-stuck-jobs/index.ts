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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[CLEANUP] Checking for stuck import jobs...');

    // Find stuck jobs (queued or processing for more than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: fetchError } = await supabase
      .from('import_jobs')
      .select('id, supplier_id, status, started_at, user_id, supplier_configurations(supplier_name)')
      .in('status', ['queued', 'processing'])
      .lt('started_at', thirtyMinutesAgo);

    if (fetchError) {
      console.error('[CLEANUP] Error fetching stuck jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP] Found ${stuckJobs?.length || 0} stuck jobs`);

    if (!stuckJobs || stuckJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No stuck jobs found', cleaned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark stuck jobs as failed
    const jobIds = stuckJobs.map(j => j.id);
    const { error: updateError } = await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: 'Import bloqué automatiquement marqué comme échoué après 30 minutes d\'inactivité',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', jobIds);

    if (updateError) {
      console.error('[CLEANUP] Error updating jobs:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP] Successfully cleaned ${stuckJobs.length} stuck jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: stuckJobs.length,
        jobs: stuckJobs.map(j => ({
          id: j.id,
          supplier: j.supplier_configurations?.supplier_name,
          status: j.status,
          started_at: j.started_at
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLEANUP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
