import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { maxConcurrent = 3, supplier_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[BATCH-PROCESS] Démarrage - Concurrence: ${maxConcurrent}`);

    // Récupérer les emails pending
    let query = supabaseClient
      .from('email_inbox')
      .select('*')
      .eq('status', 'pending')
      .order('received_at', { ascending: false })
      .limit(50);
    
    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }

    const { data: pendingEmails, error: fetchError } = await query;

    if (fetchError) {
      console.error('[BATCH-PROCESS] Erreur récupération:', fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('[BATCH-PROCESS] Aucun email à traiter');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucun email en attente',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH-PROCESS] ${pendingEmails.length} emails à traiter`);

    const results = {
      total: pendingEmails.length,
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Traiter par batch de maxConcurrent
    for (let i = 0; i < pendingEmails.length; i += maxConcurrent) {
      const batch = pendingEmails.slice(i, i + maxConcurrent);
      
      console.log(`[BATCH-PROCESS] Traitement batch ${Math.floor(i / maxConcurrent) + 1} (${batch.length} emails)`);

      const promises = batch.map(async (email) => {
        try {
          // Vérifier les doublons (même nom de fichier, même date à 1h près)
          const oneHourAgo = new Date(new Date(email.received_at).getTime() - 60 * 60 * 1000).toISOString();
          const oneHourAfter = new Date(new Date(email.received_at).getTime() + 60 * 60 * 1000).toISOString();
          
          const { data: duplicates } = await supabaseClient
            .from('email_inbox')
            .select('id')
            .eq('attachment_name', email.attachment_name)
            .eq('supplier_id', email.supplier_id)
            .eq('status', 'completed')
            .gte('received_at', oneHourAgo)
            .lte('received_at', oneHourAfter)
            .neq('id', email.id);

          if (duplicates && duplicates.length > 0) {
            console.log(`[BATCH-PROCESS] Email ${email.id} : doublon détecté, ignoré`);
            
            await supabaseClient
              .from('email_inbox')
              .update({
                status: 'ignored',
                error_message: 'Doublon détecté (même fichier déjà traité)',
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);

            results.skipped++;
            return { id: email.id, status: 'skipped', reason: 'duplicate' };
          }

          // Lancer le traitement
          const { error: invokeError } = await supabaseClient.functions.invoke('process-email-attachment', {
            body: {
              inbox_id: email.id,
              user_id: email.user_id
            }
          });

          if (invokeError) {
            console.error(`[BATCH-PROCESS] Erreur traitement ${email.id}:`, invokeError);
            results.failed++;
            return { id: email.id, status: 'failed', error: invokeError.message };
          }

          results.success++;
          return { id: email.id, status: 'processing' };

        } catch (error: any) {
          console.error(`[BATCH-PROCESS] Erreur email ${email.id}:`, error);
          results.failed++;
          return { id: email.id, status: 'error', error: error.message };
        }
      });

      const batchResults = await Promise.all(promises);
      results.details.push(...batchResults);

      // Pause entre les batches
      if (i + maxConcurrent < pendingEmails.length) {
        console.log('[BATCH-PROCESS] Pause de 3s entre batches...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('[BATCH-PROCESS] Terminé:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BATCH-PROCESS] Erreur fatale:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});