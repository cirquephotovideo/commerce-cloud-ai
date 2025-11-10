import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) throw new Error('Unauthorized');

    console.log(`[start-code2asin-export] Starting export for user ${user.id}`);

    // 1. Compter les produits avec EAN
    const { count, error: countError } = await supabaseAdmin
      .from('product_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('code2asin_enrichment_status', 'not_started')
      .not('ean', 'is', null)
      .neq('ean', '');

    if (countError) throw countError;

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun produit avec EAN à exporter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[start-code2asin-export] Found ${count} products to export`);

    // 2. Créer un export job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('code2asin_export_jobs')
      .insert({
        user_id: user.id,
        status: 'queued',
        progress_total: count,
        progress_current: 0,
        file_name: `code2asin_export_${Date.now()}.csv`
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log(`[start-code2asin-export] Created job ${job.id}`);

    // 3. Lancer le premier chunk en arrière-plan
    const chunkResponse = supabaseAdmin.functions.invoke('process-code2asin-export-chunk', {
      body: {
        export_job_id: job.id,
        offset: 0,
        chunk_size: 1000
      }
    });

    console.log(`[start-code2asin-export] Triggered first chunk processing`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        total_products: count,
        message: `Export de ${count} produits démarré en arrière-plan`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[start-code2asin-export] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
