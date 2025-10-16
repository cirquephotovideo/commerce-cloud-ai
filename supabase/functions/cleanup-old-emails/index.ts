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

    console.log('[CLEANUP] Démarrage du nettoyage automatique des emails');

    // Récupérer toutes les politiques de rétention actives
    const { data: policies, error: policiesError } = await supabaseClient
      .from('email_retention_policies')
      .select('*');

    if (policiesError) {
      console.error('[CLEANUP] Erreur récupération politiques:', policiesError);
      throw policiesError;
    }

    if (!policies || policies.length === 0) {
      console.log('[CLEANUP] Aucune politique de rétention définie');
      // Utiliser une politique par défaut : 30 jours
      const defaultPolicy = {
        auto_delete_after_days: 30,
        archive_successful: true,
        keep_failed_permanently: false
      };
      
      await processCleanup(supabaseClient, defaultPolicy, null);
    } else {
      // Traiter chaque politique utilisateur
      for (const policy of policies) {
        console.log(`[CLEANUP] Traitement politique user ${policy.user_id}`);
        await processCleanup(supabaseClient, policy, policy.user_id);
      }
    }

    console.log('[CLEANUP] Nettoyage terminé avec succès');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Nettoyage terminé',
        policiesProcessed: policies?.length || 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CLEANUP] Erreur fatale:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processCleanup(supabaseClient: any, policy: any, userId: string | null) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - policy.auto_delete_after_days);
  const cutoffIso = cutoffDate.toISOString();

  console.log(`[CLEANUP] Nettoyage emails avant ${cutoffIso}`);

  let query = supabaseClient
    .from('email_inbox')
    .select('id, attachment_url, status')
    .lt('received_at', cutoffIso);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  // Appliquer les filtres selon la politique
  if (policy.archive_successful && !policy.keep_failed_permanently) {
    // Archive que les success, garde les failed
    query = query.eq('status', 'completed');
  } else if (!policy.archive_successful && policy.keep_failed_permanently) {
    // Supprime que les non-failed
    query = query.neq('status', 'failed');
  } else if (!policy.archive_successful && !policy.keep_failed_permanently) {
    // Supprime tout
    // Pas de filtre supplémentaire
  } else {
    // archive_successful = true ET keep_failed_permanently = true
    // Ne supprime que les success
    query = query.eq('status', 'completed');
  }

  const { data: oldEmails, error: fetchError } = await query.limit(100);

  if (fetchError) {
    console.error('[CLEANUP] Erreur récupération emails:', fetchError);
    throw fetchError;
  }

  if (!oldEmails || oldEmails.length === 0) {
    console.log('[CLEANUP] Aucun email à nettoyer');
    return;
  }

  console.log(`[CLEANUP] ${oldEmails.length} emails à nettoyer`);

  // Supprimer les fichiers du storage
  for (const email of oldEmails) {
    if (email.attachment_url) {
      try {
        // Extraire le chemin du fichier depuis l'URL
        const url = new URL(email.attachment_url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
        
        if (pathMatch) {
          const bucket = pathMatch[1];
          const filePath = pathMatch[2];
          
          const { error: deleteError } = await supabaseClient
            .storage
            .from(bucket)
            .remove([filePath]);

          if (deleteError) {
            console.error(`[CLEANUP] Erreur suppression fichier ${filePath}:`, deleteError);
          } else {
            console.log(`[CLEANUP] Fichier supprimé: ${filePath}`);
          }
        }
      } catch (error: any) {
        console.error('[CLEANUP] Erreur parsing URL:', error);
      }
    }
  }

  // Supprimer les enregistrements de la DB
  const emailIds = oldEmails.map((e: any) => e.id);
  
  const { error: deleteError } = await supabaseClient
    .from('email_inbox')
    .delete()
    .in('id', emailIds);

  if (deleteError) {
    console.error('[CLEANUP] Erreur suppression emails DB:', deleteError);
    throw deleteError;
  }

  console.log(`[CLEANUP] ${emailIds.length} emails supprimés de la DB`);

  // Logger dans audit_logs
  await supabaseClient
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: 'cleanup_emails',
      entity_type: 'email_inbox',
      new_values: {
        deleted_count: emailIds.length,
        cutoff_date: cutoffIso,
        policy: policy
      }
    });
}
