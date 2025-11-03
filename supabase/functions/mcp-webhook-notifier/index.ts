import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: string;
  package_id: string;
  message: string;
  metadata?: any;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, event, package_id, message, metadata } = await req.json();

    // Fetch user's webhooks for this event
    const { data: webhooks, error } = await supabaseClient
      .from('mcp_webhooks')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) throw error;

    if (!webhooks || webhooks.length === 0) {
      console.log(`[WEBHOOK] No active webhooks for user ${user_id}, event ${event}`);
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload: WebhookPayload = {
      event,
      package_id,
      message,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Send webhooks
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhook.secret_token,
            'User-Agent': 'Commerce-Cloud-AI-Webhook/1.0'
          },
          body: JSON.stringify(payload)
        });

        // Update last_triggered_at
        await supabaseClient
          .from('mcp_webhooks')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', webhook.id);

        return { webhook_id: webhook.id, status: response.status };
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;

    console.log(`[WEBHOOK] Sent ${successCount}/${webhooks.length} webhooks for event ${event}`);

    return new Response(
      JSON.stringify({ notified: successCount, total: webhooks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
