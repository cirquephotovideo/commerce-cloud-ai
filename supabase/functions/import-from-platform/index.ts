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
    const { platform, supplier_id, filters } = await req.json();
    
    console.log('Import request:', { platform, supplier_id, filters });

    // Authentification
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Vérifier que la plateforme supporte l'import
    const { data: config, error: configError } = await supabaseClient
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', platform)
      .eq('supports_import', true)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) throw configError;

    if (!config) {
      throw new Error(`Import not supported or not configured for platform: ${platform}`);
    }

    console.log('Platform config found, dispatching to specific function...');

    // Dispatcher vers la fonction spécifique
    const { data, error } = await supabaseClient.functions.invoke(
      `import-from-${platform}`,
      {
        body: { supplier_id, filters, config },
      }
    );

    if (error) throw error;

    console.log('Import completed:', data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in import-from-platform:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        imported: 0,
        matched: 0,
        new: 0,
        errors: 1,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
