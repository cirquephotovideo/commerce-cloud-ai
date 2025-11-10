import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { export_job_id } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[finalize-export] Finalizing export ${export_job_id}`);

    const { data: job, error: jobError } = await supabase
      .from('code2asin_export_jobs')
      .select('*')
      .eq('id', export_job_id)
      .single();

    if (jobError || !job) throw new Error('Job not found');

    // 1. Lister tous les chunks
    const { data: files, error: listError } = await supabase.storage
      .from('exports')
      .list(`code2asin_exports/${job.id}`);

    if (listError) throw listError;

    if (!files || files.length === 0) {
      throw new Error('No chunks found');
    }

    console.log(`[finalize-export] Found ${files.length} chunks`);

    // 2. Télécharger et combiner tous les chunks
    const chunks: string[] = ['EAN,Titre,Marque'];
    
    const sortedFiles = files.sort((a, b) => {
      const aNum = parseInt(a.name.match(/chunk_(\d+)/)?.[1] || '0');
      const bNum = parseInt(b.name.match(/chunk_(\d+)/)?.[1] || '0');
      return aNum - bNum;
    });

    for (const file of sortedFiles) {
      const { data, error: downloadError } = await supabase.storage
        .from('exports')
        .download(`code2asin_exports/${job.id}/${file.name}`);
      
      if (downloadError) throw downloadError;
      
      if (data) {
        const text = await data.text();
        const lines = text.split('\n').slice(1);
        chunks.push(...lines.filter(l => l.trim()));
      }
    }

    console.log(`[finalize-export] Combined ${chunks.length - 1} rows`);

    // 3. Créer le fichier final
    const finalContent = chunks.join('\n');
    const finalFileName = `code2asin_exports/${job.file_name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(finalFileName, new Blob([finalContent]), {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 4. Générer URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('exports')
      .getPublicUrl(finalFileName);

    console.log(`[finalize-export] Generated public URL: ${publicUrl}`);

    // 5. Marquer le job comme complété
    await supabase
      .from('code2asin_export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_url: publicUrl
      })
      .eq('id', export_job_id);

    // 6. Nettoyer les chunks
    const filesToRemove = files.map(f => `code2asin_exports/${job.id}/${f.name}`);
    await supabase.storage
      .from('exports')
      .remove(filesToRemove);

    console.log(`[finalize-export] Cleaned up ${filesToRemove.length} chunks`);

    return new Response(
      JSON.stringify({ success: true, file_url: publicUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[finalize-code2asin-export] Error:', error);
    
    const { export_job_id } = await req.json();
    if (export_job_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('code2asin_export_jobs')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', export_job_id);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
