import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('[RETRY-JOBS] Looking for pending import jobs...');

    // Récupérer les jobs en status 'pending' avec un mapping valide
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Plus de 2 minutes
      .limit(10);

    if (jobsError) {
      console.error('[RETRY-JOBS] Error fetching jobs:', jobsError);
      throw jobsError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[RETRY-JOBS] No pending jobs found');
      return new Response(
        JSON.stringify({ message: 'No pending jobs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RETRY-JOBS] Found ${pendingJobs.length} pending jobs`);

    const results = [];

    for (const job of pendingJobs) {
      try {
        const metadata = job.metadata as any;
        
        // Vérifier que le mapping est valide
        if (!metadata?.mapping?.product_name || !metadata?.mapping?.purchase_price) {
          console.error(`[RETRY-JOBS] Invalid mapping for job ${job.id}`);
          await supabase
            .from('import_jobs')
            .update({ 
              status: 'failed',
              error_message: 'Mapping invalide - produit ou prix manquant',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          continue;
        }

        console.log(`[RETRY-JOBS] Triggering email-import-chunk for job ${job.id}`);

        // Invoquer email-import-chunk pour ce job
        const { data, error } = await supabase.functions.invoke('email-import-chunk', {
          body: {
            job_id: job.id,
            user_id: job.user_id,
            supplier_id: job.supplier_id,
            ndjson_path: metadata.ndjson_path,
            mapping: metadata.mapping,
            headers: metadata.headers || [],
            skip_config: metadata.skip_config || {},
            excluded_columns: metadata.excluded_columns || [],
            offset: 0,
            limit: 500,
            correlation_id: `retry-${job.id}-${Date.now()}`
          }
        });

        if (error) {
          console.error(`[RETRY-JOBS] Error invoking chunk for job ${job.id}:`, error);
          results.push({ jobId: job.id, status: 'error', error: error.message });
        } else {
          console.log(`[RETRY-JOBS] Successfully triggered job ${job.id}`);
          results.push({ jobId: job.id, status: 'triggered' });
        }

      } catch (error: any) {
        console.error(`[RETRY-JOBS] Error processing job ${job.id}:`, error);
        results.push({ jobId: job.id, status: 'error', error: error.message });
      }

      // Attendre un peu entre chaque job pour ne pas surcharger
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({ 
        processed: pendingJobs.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[RETRY-JOBS] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
