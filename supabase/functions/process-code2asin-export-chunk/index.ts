import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { export_job_id, offset, chunk_size } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[process-chunk] Processing chunk at offset ${offset}`);

    // 1. Récupérer le job
    const { data: job, error: jobError } = await supabase
      .from('code2asin_export_jobs')
      .select('*')
      .eq('id', export_job_id)
      .single();

    if (jobError || !job) throw new Error('Job not found');

    // 2. Update status à 'processing'
    if (job.status === 'queued') {
      await supabase
        .from('code2asin_export_jobs')
        .update({ status: 'processing' })
        .eq('id', export_job_id);
    }

    // 3. Récupérer le chunk de produits
    const { data: products, error: fetchError } = await supabase
      .from('product_analyses')
      .select('ean, analysis_result')
      .eq('user_id', job.user_id)
      .eq('code2asin_enrichment_status', 'not_started')
      .not('ean', 'is', null)
      .neq('ean', '')
      .range(offset, offset + chunk_size - 1);

    if (fetchError) throw fetchError;

    console.log(`[process-chunk] Fetched ${products.length} products`);

    // 4. Formater en CSV
    const csvLines = products.map(p => {
      const name = (p.analysis_result as any)?.product_name || '';
      const brand = (p.analysis_result as any)?.brand || '';
      return `"${p.ean}","${name.replace(/"/g, '""')}","${brand.replace(/"/g, '""')}"`;
    });

    const csvContent = ['EAN,Titre,Marque', ...csvLines].join('\n');

    // 5. Sauvegarder le chunk dans Storage
    const chunkFileName = `code2asin_exports/${job.id}/chunk_${offset}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(chunkFileName, new Blob([csvContent]), {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadError) throw uploadError;

    console.log(`[process-chunk] Uploaded chunk to ${chunkFileName}`);

    // 6. Update progression
    const newProgress = offset + products.length;
    await supabase
      .from('code2asin_export_jobs')
      .update({
        progress_current: newProgress,
        products_exported: newProgress,
        updated_at: new Date().toISOString()
      })
      .eq('id', export_job_id);

    // 7. Lancer le prochain chunk ou finaliser
    if (products.length === chunk_size && newProgress < job.progress_total) {
      console.log(`[process-chunk] Triggering next chunk at offset ${offset + chunk_size}`);
      
      supabase.functions.invoke('process-code2asin-export-chunk', {
        body: {
          export_job_id,
          offset: offset + chunk_size,
          chunk_size
        }
      });
    } else {
      console.log(`[process-chunk] Last chunk processed, finalizing...`);
      
      supabase.functions.invoke('finalize-code2asin-export', {
        body: { export_job_id }
      });
    }

    return new Response(
      JSON.stringify({ success: true, processed: products.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[process-code2asin-export-chunk] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
