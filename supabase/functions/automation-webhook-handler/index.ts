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

    const url = new URL(req.url);
    const webhookId = url.searchParams.get('id');

    if (!webhookId) {
      return new Response(
        JSON.stringify({ error: 'Webhook ID required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[WEBHOOK] Received webhook trigger for ID: ${webhookId}`);

    // Fetch webhook configuration
    const { data: webhook, error: webhookError } = await supabase
      .from('automation_webhooks')
      .select('*, automation_master_rules(*)')
      .eq('id', webhookId)
      .eq('is_active', true)
      .single();

    if (webhookError || !webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found or inactive' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify secret token if provided
    const authHeader = req.headers.get('authorization');
    if (webhook.secret_token && authHeader !== `Bearer ${webhook.secret_token}`) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse webhook payload
    const payload = await req.json().catch(() => ({}));

    console.log(`[WEBHOOK] Processing webhook for automation: ${webhook.automation_master_rules.rule_name}`);

    // Update webhook stats
    await supabase
      .from('automation_webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: webhook.trigger_count + 1,
      })
      .eq('id', webhookId);

    // Trigger the associated automation rule
    const { data, error } = await supabase.functions.invoke('automation-master-orchestrator', {
      body: {
        force_rule_id: webhook.automation_rule_id,
        webhook_payload: payload,
      },
    });

    if (error) {
      console.error(`[WEBHOOK] Error triggering automation:`, error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: webhookId,
        automation_triggered: webhook.automation_master_rules.rule_name,
        result: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WEBHOOK] Fatal error:', error);
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
