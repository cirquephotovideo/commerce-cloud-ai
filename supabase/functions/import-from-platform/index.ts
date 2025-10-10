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

    // Determine which key to use based on auth context
    const authHeader = req.headers.get('Authorization');
    let supabaseKey: string;
    let userId: string;

    if (authHeader) {
      // UI call: use ANON_KEY to validate user token
      supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      console.log('Using ANON_KEY for UI authentication');
    } else {
      // Auto-sync call: use SERVICE_ROLE_KEY
      supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      console.log('Using SERVICE_ROLE_KEY for auto-sync');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseKey
    );

    // Get user ID based on context
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('Authentication error:', authError);
        throw new Error('Unauthorized');
      }
      
      userId = user.id;
      console.log('Authenticated user:', userId);
    } else {
      // Get user_id from supplier configuration
      const { data: supplier, error: supplierError } = await supabaseClient
        .from('supplier_configurations')
        .select('user_id')
        .eq('id', supplier_id)
        .single();

      if (supplierError || !supplier) {
        console.error('Supplier lookup error:', supplierError);
        throw new Error('Supplier not found');
      }

      userId = supplier.user_id;
      console.log('Using supplier user_id:', userId);
    }

    // Verify that the platform supports import
    const { data: config, error: configError } = await supabaseClient
      .from('platform_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform_type', platform)
      .eq('supports_import', true)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) {
      console.error('Platform config error:', configError);
      throw configError;
    }

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
