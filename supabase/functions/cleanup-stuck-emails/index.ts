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

    console.log('[CLEANUP-STUCK] Démarrage du nettoyage des emails bloqués...');

    // Trouver les emails bloqués en 'processing' depuis plus de 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckEmails, error: fetchError } = await supabaseClient
      .from('email_inbox')
      .select('id, from_email, attachment_name, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', tenMinutesAgo);

    if (fetchError) {
      console.error('[CLEANUP-STUCK] Erreur fetch:', fetchError);
      throw fetchError;
    }

    if (!stuckEmails || stuckEmails.length === 0) {
      console.log('[CLEANUP-STUCK] Aucun email bloqué trouvé');
      return new Response(
        JSON.stringify({ success: true, cleaned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP-STUCK] ${stuckEmails.length} emails bloqués trouvés`);

    // Marquer comme failed avec message explicite
    const { error: updateError } = await supabaseClient
      .from('email_inbox')
      .update({
        status: 'failed',
        error_message: 'Timeout: traitement bloqué pendant plus de 10 minutes (nettoyage automatique)',
        updated_at: new Date().toISOString()
      })
      .in('id', stuckEmails.map(e => e.id));

    if (updateError) {
      console.error('[CLEANUP-STUCK] Erreur update:', updateError);
      throw updateError;
    }

    console.log(`[CLEANUP-STUCK] ✓ ${stuckEmails.length} emails marqués comme failed`);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: stuckEmails.length,
        emails: stuckEmails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CLEANUP-STUCK] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
