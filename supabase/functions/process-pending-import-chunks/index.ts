import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[PENDING-CHUNKS] Checking for stuck import jobs...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find jobs stuck in 'processing' for >5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: fetchError } = await supabaseClient
      .from('import_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('updated_at', fiveMinutesAgo)
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('[PENDING-CHUNKS] No stuck jobs found');
      return new Response(
        JSON.stringify({ message: 'No stuck jobs found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PENDING-CHUNKS] Found ${stuckJobs.length} stuck jobs, restarting...`);

    // Restart each stuck job from last known offset
    for (const job of stuckJobs) {
      const lastOffset = job.metadata?.last_offset || 0;
      const chunkSize = job.metadata?.chunk_size || 500;
      const platform = job.metadata?.platform || 'odoo';
      const options = job.metadata?.options || {};
      
      console.log(`[PENDING-CHUNKS] Restarting job ${job.id} from offset ${lastOffset}`);
      
      // Reset retry count
      await supabaseClient
        .from('import_jobs')
        .update({
          metadata: {
            ...job.metadata,
            retry_count: 0,
            restarted_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      // Restart from last known offset
      await supabaseClient.functions.invoke('process-import-chunk', {
        body: {
          import_job_id: job.id,
          supplier_id: job.supplier_id,
          platform,
          offset: lastOffset,
          limit: chunkSize,
          options,
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        restarted: stuckJobs.length,
        message: `Restarted ${stuckJobs.length} stuck jobs`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[PENDING-CHUNKS] Error:', error);
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
