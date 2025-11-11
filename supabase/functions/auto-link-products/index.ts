import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[auto-link-products] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('[auto-link-products] Auth error:', userError?.message || 'No user found');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        details: userError?.message || 'Invalid or expired token' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[auto-link-products] Authenticated user:', user.id);

    const { auto_mode = false } = await req.json();

    // MODE GLOBAL OPTIMISÉ: Utiliser la fonction SQL batch
    if (auto_mode) {
      console.log('[auto-link-products] Mode global optimisé - utilisation de bulk_create_product_links');
      
      // Compter le nombre potentiel de correspondances
      const { count: potentialMatches } = await supabase
        .from('product_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('ean', 'is', null)
        .neq('ean', '');

      console.log(`[auto-link-products] ${potentialMatches} produits analysés avec EAN`);

      // Appeler la fonction SQL batch
      const { data, error: rpcError } = await supabase
        .rpc('bulk_create_product_links', { p_user_id: user.id });

      if (rpcError) {
        console.error('[auto-link-products] RPC error:', rpcError);
        throw rpcError;
      }

      const result = data?.[0] || { links_created: 0, execution_time_ms: 0 };
      const executionTime = Date.now() - startTime;

      console.log(`[auto-link-products] Batch completed: ${result.links_created} links created in ${result.execution_time_ms}ms (total: ${executionTime}ms)`);

      return new Response(
        JSON.stringify({
          links_created: result.links_created,
          potential_matches: potentialMatches,
          execution_time_ms: executionTime,
          sql_execution_time_ms: result.execution_time_ms,
          mode: 'batch_optimized',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fallback: mode non-optimisé (pour compatibilité)
    return new Response(
      JSON.stringify({ 
        error: 'Mode non supporté. Utilisez auto_mode=true pour la fusion batch.' 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[auto-link-products] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
