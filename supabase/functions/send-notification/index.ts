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
