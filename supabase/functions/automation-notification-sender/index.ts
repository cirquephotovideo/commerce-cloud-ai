import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    const { ruleId, notificationType, message, details } = await req.json();

    console.log(`[NOTIFICATION] Sending ${notificationType} notification for rule: ${ruleId}`);

    // Fetch notification configurations for this rule
    const { data: notifications, error: fetchError } = await supabase
      .from('automation_notifications')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('is_active', true);

    if (fetchError) {
      throw fetchError;
    }

    const results = [];

    for (const notification of notifications || []) {
      try {
        switch (notification.notification_type) {
          case 'email':
            await sendEmailNotification(supabase, notification, message, details);
            break;

          case 'in_app':
            await sendInAppNotification(supabase, notification, message, details);
            break;

          case 'webhook':
            await sendWebhookNotification(notification, message, details);
            break;

          case 'slack':
            await sendSlackNotification(notification, message, details);
            break;

          default:
            console.log(`[NOTIFICATION] Unknown type: ${notification.notification_type}`);
        }

        // Update notification stats
        await supabase
          .from('automation_notifications')
          .update({
            last_sent_at: new Date().toISOString(),
            sent_count: notification.sent_count + 1,
          })
          .eq('id', notification.id);

        results.push({
          notification_id: notification.id,
          type: notification.notification_type,
          status: 'sent',
        });

      } catch (error) {
        console.error(`[NOTIFICATION] Error sending ${notification.notification_type}:`, error);
        results.push({
          notification_id: notification.id,
          type: notification.notification_type,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NOTIFICATION] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendEmailNotification(supabase: any, notification: any, message: string, details: any) {
  const { error } = await supabase.functions.invoke('send-notification', {
    body: {
      userId: notification.user_id,
      type: 'email',
      subject: `Alerte Automatisation: ${details?.rule_name || 'Notification'}`,
      message,
      details,
    },
  });

  if (error) throw error;
}

async function sendInAppNotification(supabase: any, notification: any, message: string, details: any) {
  const { error } = await supabase.functions.invoke('send-user-alert', {
    body: {
      userId: notification.user_id,
      alertType: 'automation_notification',
      message,
      metadata: details,
    },
  });

  if (error) throw error;
}

async function sendWebhookNotification(notification: any, message: string, details: any) {
  const webhookUrl = notification.config.webhook_url;
  
  if (!webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(notification.config.headers || {}),
    },
    body: JSON.stringify({
      message,
      details,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

async function sendSlackNotification(notification: any, message: string, details: any) {
  const slackWebhook = notification.config.slack_webhook_url;
  
  if (!slackWebhook) {
    throw new Error('Slack webhook URL not configured');
  }

  const response = await fetch(slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${message}*`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Règle: ${details?.rule_name || 'N/A'} | ${new Date().toLocaleString('fr-FR')}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}
