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
    console.log('[INIT-VIEW] Starting materialized view initialization...');
    const startTime = Date.now();

    // Use service role with extended statement timeout
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Try REFRESH with extended timeout
    console.log('[INIT-VIEW] Step 1: Attempting full refresh...');
    
    const { error: refreshError } = await supabase.rpc('refresh_unified_products_materialized');

    if (refreshError) {
      console.error('[INIT-VIEW] Full refresh failed:', refreshError);
      
      // If timeout, return partial success - the function has 10min timeout
      if (refreshError.code === '57014') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Materialized view refresh timeout',
          hint: 'Try calling this function multiple times, or reduce data volume',
          attempted: true,
          duration_ms: Date.now() - startTime
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202 // Accepted but not completed
        });
      }
      
      throw refreshError;
    }

    const duration = Date.now() - startTime;
    console.log(`[INIT-VIEW] ✅ View refreshed successfully in ${duration}ms`);

    // Log success
    await supabase.from('system_health_logs').insert({
      test_type: 'materialized_view_init',
      component_name: 'unified_products',
      status: 'healthy',
      test_result: {
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        method: 'full_refresh'
      }
    });

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      message: 'Materialized view initialized and ready'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[INIT-VIEW] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      code: error.code,
      hint: error.hint || 'Check database logs for more details'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
