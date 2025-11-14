import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchResult {
  analysis_id: string;
  enrichment_id: string;
  matched_on: string;
  confidence_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let job_id: string | undefined;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    job_id = body.job_id;
    const offset = body.offset || 0;
    const batch_size = body.batch_size || 100;

    console.log(`[AMAZON-AUTO-LINK] Starting batch - Job: ${job_id}, Offset: ${offset}, Batch: ${batch_size}`);

    // Mark job as processing on first run
    if (offset === 0 && job_id) {
      console.log(`[AMAZON-AUTO-LINK] Marking job ${job_id} as processing`);
      await supabase
        .from('amazon_auto_link_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', job_id);
    }

    // Get product analyses without Amazon links
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('id, ean, analysis_result')
      .eq('user_id', user.id)
      .not('ean', 'is', null)
      .range(offset, offset + batch_size - 1);

    if (analysesError) {
      console.error('[AMAZON-AUTO-LINK] Error fetching analyses:', analysesError);
      throw analysesError;
    }

    console.log(`[AMAZON-AUTO-LINK] Found ${analyses?.length || 0} analyses to process`);

    // Get Code2ASIN enrichments
    const { data: enrichments, error: enrichmentsError } = await supabase
      .from('code2asin_enrichments')
      .select('id, ean, asin, title, brand')
      .eq('user_id', user.id)
      .not('ean', 'is', null);

    if (enrichmentsError) {
      console.error('[AMAZON-AUTO-LINK] Error fetching enrichments:', enrichmentsError);
      throw enrichmentsError;
    }

    console.log(`[AMAZON-AUTO-LINK] Found ${enrichments?.length || 0} Code2ASIN enrichments`);

    // Create EAN index for fast lookup
    const enrichmentsByEan = new Map<string, any[]>();
    enrichments?.forEach(enr => {
      if (enr.ean) {
        if (!enrichmentsByEan.has(enr.ean)) {
          enrichmentsByEan.set(enr.ean, []);
        }
        enrichmentsByEan.get(enr.ean)!.push(enr);
      }
    });

    const matches: MatchResult[] = [];

    // Match products with enrichments
    for (const analysis of analyses || []) {
      if (!analysis.ean) continue;

      // Check if link already exists
      const { data: existingLink } = await supabase
        .from('product_amazon_links')
        .select('id')
        .eq('analysis_id', analysis.id)
        .single();

      if (existingLink) continue;

      // Try to match by EAN
      const enrichmentsForEan = enrichmentsByEan.get(analysis.ean);
      if (enrichmentsForEan && enrichmentsForEan.length > 0) {
        // Use first match (could be improved with better matching logic)
        const enrichment = enrichmentsForEan[0];
        
        matches.push({
          analysis_id: analysis.id,
          enrichment_id: enrichment.id,
          matched_on: 'ean',
          confidence_score: 100
        });
      }
    }

    console.log(`[AMAZON-AUTO-LINK] Found ${matches.length} matches to create`);

    // Insert matches into database
    if (matches.length > 0) {
      const linksToInsert = matches.map(match => ({
        user_id: user.id,
        analysis_id: match.analysis_id,
        enrichment_id: match.enrichment_id,
        link_type: 'automatic',
        confidence_score: match.confidence_score,
        matched_on: match.matched_on
      }));

      const { error: insertError } = await supabase
        .from('product_amazon_links')
        .insert(linksToInsert);

      if (insertError) {
        console.error('[AMAZON-AUTO-LINK] Error inserting links:', insertError);
        throw insertError;
      }
      
      console.log(`[AMAZON-AUTO-LINK] ✅ Successfully created ${matches.length} Amazon links`);
    }

    // Update job progress
    if (job_id) {
      const newOffset = offset + batch_size;
      const isComplete = !analyses || analyses.length < batch_size;

      // Get current links_created count
      const { data: currentJob } = await supabase
        .from('amazon_auto_link_jobs')
        .select('links_created')
        .eq('id', job_id)
        .single();

      const totalLinksCreated = (currentJob?.links_created || 0) + matches.length;

      console.log(`[AMAZON-AUTO-LINK] Updating job: processed=${newOffset}, links=${totalLinksCreated}, complete=${isComplete}`);

      await supabase
        .from('amazon_auto_link_jobs')
        .update({
          processed_count: newOffset,
          links_created: totalLinksCreated,
          current_offset: newOffset,
          status: isComplete ? 'completed' : 'processing',
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', job_id);

      // If not complete, invoke next batch
      if (!isComplete) {
        console.log(`[AMAZON-AUTO-LINK] 🔄 Invoking next batch at offset ${newOffset}`);
        await supabase.functions.invoke('process-amazon-auto-link', {
          body: {
            job_id,
            offset: newOffset,
            batch_size
          }
        });
      } else {
        console.log(`[AMAZON-AUTO-LINK] ✅ Job ${job_id} completed!`);
        
        // Send completion email notification
        const completedJob = await supabase
          .from('amazon_auto_link_jobs')
          .select('*')
          .eq('id', job_id)
          .single();

        if (completedJob.data) {
          const durationMinutes = completedJob.data.started_at && completedJob.data.completed_at
            ? Math.round((new Date(completedJob.data.completed_at).getTime() - new Date(completedJob.data.started_at).getTime()) / 60000)
            : 0;

          const successRate = completedJob.data.total_to_process > 0
            ? Math.round((completedJob.data.links_created / completedJob.data.total_to_process) * 100)
            : 0;

          console.log(`[AMAZON-AUTO-LINK] Sending completion email to user ${user.id}`);
          
          await supabase.functions.invoke('send-notification', {
            body: {
              userId: user.id,
              type: 'amazon_auto_link_complete',
              data: {
                job_id: job_id,
                status: completedJob.data.status,
                total_to_process: completedJob.data.total_to_process,
                processed_count: completedJob.data.processed_count,
                links_created: completedJob.data.links_created,
                duration_minutes: durationMinutes,
                success_rate: successRate,
                started_at: completedJob.data.started_at,
                completed_at: completedJob.data.completed_at
              }
            }
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches_found: matches.length,
        processed: analyses?.length || 0,
        offset: offset + batch_size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AMAZON-AUTO-LINK] ❌ Error:', error);
    
    // Mark job as failed if job_id is available
    if (job_id) {
      console.log(`[AMAZON-AUTO-LINK] Marking job ${job_id} as failed`);
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: failedJob } = await supabase
        .from('amazon_auto_link_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id)
        .select()
        .single();

      // Send failure email notification
      if (failedJob) {
        const durationMinutes = failedJob.started_at
          ? Math.round((new Date().getTime() - new Date(failedJob.started_at).getTime()) / 60000)
          : 0;

        try {
          const authHeader = req.headers.get('Authorization');
          if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);
            
            if (user) {
              console.log(`[AMAZON-AUTO-LINK] Sending failure email to user ${user.id}`);
              await supabase.functions.invoke('send-notification', {
                body: {
                  userId: user.id,
                  type: 'amazon_auto_link_complete',
                  data: {
                    job_id: job_id,
                    status: 'failed',
                    total_to_process: failedJob.total_to_process,
                    processed_count: failedJob.processed_count,
                    links_created: failedJob.links_created,
                    duration_minutes: durationMinutes,
                    success_rate: 0,
                    error_message: error instanceof Error ? error.message : 'Unknown error',
                    started_at: failedJob.started_at,
                    completed_at: failedJob.completed_at
                  }
                }
              });
            }
          }
        } catch (emailError) {
          console.error('[AMAZON-AUTO-LINK] Failed to send failure email:', emailError);
        }
      }
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
