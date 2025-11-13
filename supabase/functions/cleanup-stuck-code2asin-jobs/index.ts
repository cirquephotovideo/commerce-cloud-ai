import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[CLEANUP-CODE2ASIN] Looking for stuck jobs...');

    // Mark jobs stuck in 'processing' for more than 10 minutes as failed
    const { data: stuckJobs, error: updateError } = await supabaseClient
      .from('code2asin_import_jobs')
      .update({
        status: 'failed',
        error_message: 'Job timeout - import trop volumineux, réessayez avec le système de chunks',
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .select();

    if (updateError) {
      throw updateError;
    }

    const count = stuckJobs?.length || 0;
    console.log(`[CLEANUP-CODE2ASIN] Marked ${count} stuck jobs as failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cleanedCount: count,
        jobs: stuckJobs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLEANUP-CODE2ASIN] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
