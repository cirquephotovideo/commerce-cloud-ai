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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    );

    // Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const timeWindow = url.searchParams.get('window') || '1 hour';
    const scope = url.searchParams.get('scope') || 'user'; // 'user' or 'global' (admin only)

    // Call metrics function
    const { data: metrics, error } = await supabase.rpc('get_import_metrics', {
      p_user_id: scope === 'user' ? user.id : null,
      time_window: timeWindow
    });

    if (error) {
      console.error('[METRICS-COLLECTOR] RPC error:', error);
      throw error;
    }

    const [result] = metrics || [];

    return new Response(JSON.stringify({
      success: true,
      time_window: timeWindow,
      scope,
      metrics: {
        imports_per_minute: Number(result?.imports_per_minute || 0).toFixed(2),
        avg_chunk_duration_seconds: Number(result?.avg_chunk_duration_seconds || 0).toFixed(2),
        error_rate: Number(result?.error_rate || 0).toFixed(4),
        total_processed: result?.total_processed || 0,
        total_errors: result?.total_errors || 0,
        active_jobs: result?.active_jobs || 0,
        stalled_jobs: result?.stalled_jobs || 0,
        dlq_entries: result?.dlq_entries || 0
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[METRICS-COLLECTOR] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
