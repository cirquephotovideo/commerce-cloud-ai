import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[CRON] Checking Amazon credentials expiry...');

    // Récupérer les credentials actives
    const { data: credentials, error } = await supabase
      .from('amazon_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching credentials:', error);
      throw error;
    }

    if (!credentials) {
      console.log('No active Amazon credentials found');
      return new Response(
        JSON.stringify({ message: 'No active credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresAt = new Date(credentials.secret_expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Days until expiry: ${daysUntilExpiry}`);

    // Alertes selon les seuils
    let shouldAlert = false;
    let alertLevel: 'warning' | 'critical' = 'warning';
    let alertMessage = '';

    if (daysUntilExpiry <= 7) {
      shouldAlert = true;
      alertLevel = 'critical';
      alertMessage = `🚨 URGENT: Amazon Client Secret expire dans ${daysUntilExpiry} jours ! Rotation immédiate requise.`;
    } else if (daysUntilExpiry <= 30) {
      shouldAlert = true;
      alertLevel = 'warning';
      alertMessage = `⚠️ Amazon Client Secret expire dans ${daysUntilExpiry} jours. Planifier la rotation.`;
    } else if (daysUntilExpiry <= 60) {
      shouldAlert = true;
      alertLevel = 'warning';
      alertMessage = `ℹ️ Amazon Client Secret expire dans ${daysUntilExpiry} jours.`;
    }

    if (shouldAlert) {
      console.log(`Sending alert: ${alertMessage}`);

      // Créer une alerte utilisateur pour tous les super admins
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (adminRoles) {
        for (const admin of adminRoles) {
          await supabase.from('user_alerts').insert({
            user_id: admin.user_id,
            alert_type: 'credential_expiry',
            severity: alertLevel,
            title: 'Expiration Credentials Amazon',
            message: alertMessage,
            action_url: '/admin?tab=apikeys',
            metadata: {
              expires_at: credentials.secret_expires_at,
              days_until_expiry: daysUntilExpiry
            }
          });
        }
      }

      // Logger l'événement
      await supabase.from('system_health_logs').insert({
        test_type: 'credential_check',
        component_name: 'amazon_credentials',
        status: alertLevel === 'critical' ? 'failing' : 'warning',
        test_result: {
          days_until_expiry: daysUntilExpiry,
          expires_at: credentials.secret_expires_at
        },
        error_message: alertLevel === 'critical' ? alertMessage : null
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        days_until_expiry: daysUntilExpiry,
        alert_sent: shouldAlert,
        alert_level: shouldAlert ? alertLevel : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-amazon-credentials-expiry:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});