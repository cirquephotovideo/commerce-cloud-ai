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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[REFRESH-VIEW] Starting materialized view refresh...');
    const startTime = Date.now();

    // Use RPC to call the refresh function with extended timeout
    const { error } = await supabase.rpc('refresh_unified_products_materialized');

    if (error) {
      console.error('[REFRESH-VIEW] Error:', error);
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`[REFRESH-VIEW] ✅ Completed in ${duration}ms`);

    // Log the refresh
    await supabase.from('system_health_logs').insert({
      test_type: 'materialized_view_refresh',
      component_name: 'unified_products',
      status: 'healthy',
      test_result: {
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      message: 'Materialized view refreshed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[REFRESH-VIEW] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      hint: 'Try refreshing again or check database load'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
