import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { retentionDays = 30 } = await req.json().catch(() => ({ retentionDays: 30 }));

    console.log(`[CLEANUP-EMAILS] Starting cleanup with ${retentionDays} days retention`);

    // Date limite : emails plus anciens que X jours
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Récupérer tous les emails
    const { data: allEmails, error: fetchError } = await supabase
      .from('email_inbox')
      .select('id, detected_supplier_name, received_at')
      .order('received_at', { ascending: false });

    if (fetchError) throw fetchError;

    if (!allEmails || allEmails.length === 0) {
      console.log('[CLEANUP-EMAILS] No emails found');
      return new Response(
        JSON.stringify({ deleted: 0, message: 'Aucun email trouvé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Grouper par fournisseur
    const grouped: Record<string, typeof allEmails> = {};
    allEmails.forEach(email => {
      const supplier = email.detected_supplier_name || 'unknown';
      if (!grouped[supplier]) grouped[supplier] = [];
      grouped[supplier].push(email);
    });

    console.log(`[CLEANUP-EMAILS] Found ${Object.keys(grouped).length} suppliers`);

    // Pour chaque fournisseur, garder les 3 plus récents, supprimer le reste s'ils sont anciens
    const idsToDelete: string[] = [];
    
    Object.entries(grouped).forEach(([supplier, emails]) => {
      console.log(`[CLEANUP-EMAILS] Processing ${supplier}: ${emails.length} emails`);
      
      // Garde les 3 plus récents
      const toKeep = emails.slice(0, 3);
      const candidates = emails.slice(3);
      
      // Supprime ceux qui sont plus anciens que la date limite
      const oldEmails = candidates.filter(email => 
        new Date(email.received_at) < cutoffDate
      );
      
      if (oldEmails.length > 0) {
        console.log(`[CLEANUP-EMAILS] ${supplier}: deleting ${oldEmails.length} old emails (keeping 3 most recent)`);
        idsToDelete.push(...oldEmails.map(e => e.id));
      }
    });

    if (idsToDelete.length === 0) {
      console.log('[CLEANUP-EMAILS] No emails to delete');
      return new Response(
        JSON.stringify({ 
          deleted: 0, 
          message: 'Aucun email à nettoyer (3 emails maximum par fournisseur conservés)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supprimer les emails en batch
    const { error: deleteError } = await supabase
      .from('email_inbox')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) throw deleteError;

    console.log(`[CLEANUP-EMAILS] Successfully deleted ${idsToDelete.length} emails`);

    return new Response(
      JSON.stringify({ 
        deleted: idsToDelete.length,
        message: `${idsToDelete.length} email(s) supprimé(s) (plus de ${retentionDays} jours, 3 emails max par fournisseur conservés)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CLEANUP-EMAILS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
