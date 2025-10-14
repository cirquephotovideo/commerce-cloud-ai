import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
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
    const supplierId = url.searchParams.get('supplier_id');
    const webhookToken = url.searchParams.get('token');

    if (!supplierId || !webhookToken) {
      return new Response(
        JSON.stringify({ error: 'Missing supplier_id or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WEBHOOK] Received webhook for supplier ${supplierId}`);

    // Verify supplier and token
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      console.error('[WEBHOOK] Supplier not found:', supplierError);
      return new Response(
        JSON.stringify({ error: 'Invalid supplier' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook token (stored in config)
    const config = supplier.config as any;
    if (!config?.webhook_token || config.webhook_token !== webhookToken) {
      console.error('[WEBHOOK] Invalid webhook token');
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    const payload = await req.json();
    console.log('[WEBHOOK] Payload:', payload);

    // Handle different webhook types
    const eventType = payload.event_type || payload.type || 'update';

    switch (eventType) {
      case 'price_update':
      case 'stock_update':
      case 'product_update':
        // Trigger a sync for this supplier
        await supabase.functions.invoke('supplier-sync-scheduler', {
          body: { supplierId: supplier.id, priority: 'high' }
        });
        
        console.log('[WEBHOOK] Triggered sync for supplier');
        break;

      case 'catalog_update':
        // Full catalog sync needed
        await supabase.functions.invoke('supplier-sync-scheduler', {
          body: { supplierId: supplier.id, fullSync: true }
        });
        
        console.log('[WEBHOOK] Triggered full catalog sync');
        break;

      default:
        console.log('[WEBHOOK] Unknown event type:', eventType);
    }

    // Log the webhook event
    await supabase.from('supplier_webhook_logs').insert({
      supplier_id: supplier.id,
      user_id: supplier.user_id,
      event_type: eventType,
      payload: payload,
      processed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        event_type: eventType 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WEBHOOK] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
