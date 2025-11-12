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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, type, data } = await req.json();

    console.log(`Sending notification to user ${userId}, type: ${type}`);

    // Récupérer les préférences de notification
    const { data: prefs, error: prefsError } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsError) {
      console.error('Error fetching preferences:', prefsError);
    }

    // Vérifier si l'utilisateur veut recevoir ce type de notification
    const shouldSend = prefs?.email_enabled ?? true;

    if (!shouldSend) {
      console.log('User has disabled notifications');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'User disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer l'email de l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      throw new Error('User not found');
    }

    const emailAddress = prefs?.email_address || user.email;

    if (!emailAddress) {
      throw new Error('No email address found');
    }

    // Préparer le contenu de l'email selon le type
    let subject = '';
    let html = '';

    switch (type) {
      case 'price_change':
        subject = `Changement de prix détecté: ${data.product_name}`;
        html = `
          <h2>Changement de Prix</h2>
          <p>Le prix de <strong>${data.product_name}</strong> a changé:</p>
          <p>Ancien prix: ${data.old_price}€</p>
          <p>Nouveau prix: ${data.new_price}€</p>
          <p>Changement: ${data.change_percent}%</p>
        `;
        break;
      
      case 'price_opportunity':
        subject = `Opportunité de prix: ${data.product_name}`;
        html = `
          <h2>Bonne Affaire Détectée!</h2>
          <p><strong>${data.product_name}</strong></p>
          <p>Prix trouvé: <strong>${data.best_price}€</strong></p>
          <p>Prix moyen du marché: ${data.average_price}€</p>
          <p>Économie potentielle: <strong>${data.savings_percent}%</strong></p>
          ${data.merchant ? `<p>Marchand: ${data.merchant}</p>` : ''}
          ${data.url ? `<p><a href="${data.url}">Voir l'offre</a></p>` : ''}
        `;
        break;
      
      case 'import_complete':
        subject = 'Import de produits terminé';
        html = `
          <h2>Import Terminé</h2>
          <p>Votre import de produits est terminé.</p>
          <p>Produits importés: ${data.imported_count || 0}</p>
          <p>Produits mis à jour: ${data.updated_count || 0}</p>
          ${data.errors_count ? `<p>Erreurs: ${data.errors_count}</p>` : ''}
        `;
        break;
      
      case 'export_complete':
        subject = 'Export de produits terminé';
        html = `
          <h2>Export Terminé</h2>
          <p>Votre export vers ${data.platform} est terminé.</p>
          <p>Produits exportés: ${data.exported_count || 0}</p>
        `;
        break;
      
      case 'amazon_auto_link_complete':
        const isSuccess = data.status === 'completed';
        subject = isSuccess 
          ? '✅ Fusion Amazon terminée avec succès' 
          : '❌ Fusion Amazon échouée';
        
        const statusColor = isSuccess ? '#10b981' : '#ef4444';
        const statusIcon = isSuccess ? '✅' : '❌';
        const statusText = isSuccess ? 'Terminé avec succès' : 'Échec';
        
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b; border-bottom: 3px solid ${statusColor}; padding-bottom: 10px;">
              🛒 Fusion Amazon - Rapport Détaillé
            </h2>
            
            <div style="background: ${isSuccess ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
              <h3 style="margin-top: 0; color: ${statusColor};">
                ${statusIcon} ${statusText}
              </h3>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: bold; color: #64748b;">Statut:</td>
                  <td style="padding: 12px 0; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: bold; color: #64748b;">Durée:</td>
                  <td style="padding: 12px 0;">${data.duration_minutes} minute${data.duration_minutes > 1 ? 's' : ''}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: bold; color: #64748b;">Produits traités:</td>
                  <td style="padding: 12px 0;">${data.processed_count} / ${data.total_to_process}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: bold; color: #64748b;">Liens créés:</td>
                  <td style="padding: 12px 0; color: #10b981; font-weight: bold; font-size: 18px;">${data.links_created}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: bold; color: #64748b;">Taux de réussite:</td>
                  <td style="padding: 12px 0;">
                    <div style="background: #e2e8f0; border-radius: 4px; height: 24px; position: relative; overflow: hidden;">
                      <div style="background: ${statusColor}; width: ${data.success_rate || 0}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
                        ${data.success_rate || 0}%
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
            
            ${data.error_message ? `
              <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #dc2626;">⚠️ Erreur détectée</h4>
                <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 13px;">${data.error_message}</p>
              </div>
            ` : ''}
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                <strong>Début:</strong> ${new Date(data.started_at).toLocaleString('fr-FR')}<br>
                <strong>Fin:</strong> ${new Date(data.completed_at || new Date()).toLocaleString('fr-FR')}
              </p>
            </div>
            
            ${isSuccess ? `
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #64748b; margin-bottom: 15px;">
                  🎉 ${data.links_created} nouveau${data.links_created > 1 ? 'x' : ''} lien${data.links_created > 1 ? 's' : ''} Amazon créé${data.links_created > 1 ? 's' : ''} automatiquement !
                </p>
                <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                  Vous pouvez maintenant enrichir vos produits avec les données Amazon
                </p>
              </div>
            ` : `
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #64748b; margin-bottom: 15px;">
                  💡 Vous pouvez relancer la fusion depuis l'interface
                </p>
              </div>
            `}
          </div>
        `;
        break;
      
      default:
        subject = 'Notification Tarifique';
        html = `<p>${JSON.stringify(data)}</p>`;
    }

    // Envoyer l'email avec Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    const emailResult = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tarifique <onboarding@resend.dev>',
        to: [emailAddress],
        subject,
        html,
      }),
    });

    const emailData = await emailResult.json();
    console.log('Email sent:', emailData);

    return new Response(
      JSON.stringify({ success: true, emailResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
