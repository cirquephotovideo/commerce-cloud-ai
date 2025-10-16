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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[AUTO-RETRY] Démarrage de la récupération automatique des emails en erreur');

    // Récupérer les emails en erreur depuis plus de 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: failedEmails, error: fetchError } = await supabaseClient
      .from('email_inbox')
      .select('*')
      .eq('status', 'failed')
      .lt('updated_at', fiveMinutesAgo)
      .limit(10);

    if (fetchError) {
      console.error('[AUTO-RETRY] Erreur récupération emails:', fetchError);
      throw fetchError;
    }

    if (!failedEmails || failedEmails.length === 0) {
      console.log('[AUTO-RETRY] Aucun email en erreur à retraiter');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Aucun email à retraiter',
          retried: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTO-RETRY] ${failedEmails.length} emails en erreur trouvés`);

    const results = [];
    
    for (const email of failedEmails) {
      const logs = email.processing_logs || [];
      const lastLog = logs[logs.length - 1];
      
      // Analyser le type d'erreur
      const errorMessage = email.error_message?.toLowerCase() || '';
      const isTemporaryError = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connexion') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ECONNRESET');
      
      const isMappingError = 
        errorMessage.includes('mapping') ||
        errorMessage.includes('column');

      // Compter les tentatives (max 3)
      const retryCount = logs.filter((l: any) => l.type === 'retry').length;
      
      if (retryCount >= 3) {
        console.log(`[AUTO-RETRY] Email ${email.id} : max retries atteint (${retryCount})`);
        results.push({ id: email.id, status: 'max_retries', retryCount });
        continue;
      }

      // Décider si on retry
      let shouldRetry = false;
      let retryReason = '';

      if (isTemporaryError) {
        shouldRetry = true;
        retryReason = 'Erreur temporaire (timeout/connexion)';
      } else if (isMappingError && retryCount === 0) {
        shouldRetry = true;
        retryReason = 'Erreur de mapping - tentative avec suggestion automatique';
      }

      if (shouldRetry) {
        console.log(`[AUTO-RETRY] Retraitement de ${email.id} : ${retryReason}`);
        
        // Ajouter log de retry
        const updatedLogs = [
          ...logs,
          {
            type: 'retry',
            timestamp: new Date().toISOString(),
            message: `Retry automatique #${retryCount + 1}`,
            reason: retryReason
          }
        ];

        // Marquer comme pending pour retraitement
        const { error: updateError } = await supabaseClient
          .from('email_inbox')
          .update({
            status: 'pending',
            processing_logs: updatedLogs,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`[AUTO-RETRY] Erreur update ${email.id}:`, updateError);
          results.push({ id: email.id, status: 'error', error: updateError.message });
        } else {
          // Déclencher le retraitement
          try {
            await supabaseClient.functions.invoke('process-email-attachment', {
              body: {
                inbox_id: email.id,
                user_id: email.user_id
              }
            });
            results.push({ id: email.id, status: 'retried', reason: retryReason, attempt: retryCount + 1 });
          } catch (invokeError) {
            console.error(`[AUTO-RETRY] Erreur invoke ${email.id}:`, invokeError);
            results.push({ id: email.id, status: 'invoke_error' });
          }
        }
      } else {
        console.log(`[AUTO-RETRY] Email ${email.id} : ne peut pas être retraité automatiquement`);
        results.push({ id: email.id, status: 'not_retryable', reason: errorMessage });
      }

      // Pause entre chaque email
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[AUTO-RETRY] Terminé. Résultats:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        totalChecked: failedEmails.length,
        results,
        retriedCount: results.filter(r => r.status === 'retried').length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTO-RETRY] Erreur fatale:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});