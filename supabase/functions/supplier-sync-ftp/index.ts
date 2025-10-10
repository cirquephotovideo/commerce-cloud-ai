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

    const { supplierId } = await req.json();

    console.log('Starting FTP/SFTP sync for supplier:', supplierId);

    // Load supplier configuration (using service role key, no user check)
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error('Supplier not found');
    }

    const config = supplier.connection_config as any;
    
    if (!config?.host || !config?.username || !config?.password) {
      console.log('FTP config incomplete for supplier:', supplierId);
      return new Response(
        JSON.stringify({
          success: false,
          message: '⚠️ Configuration FTP incomplète (host/username/password manquant)',
          warning: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, FTP sync requires manual file upload
    // This will be enhanced in future versions with actual FTP/SFTP client
    console.log('FTP sync configured for:', config.host);

    return new Response(
      JSON.stringify({
        success: false,
        message: '⚠️ FTP/SFTP non encore supporté – utilisez Import CSV/XLSX',
        warning: true
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('FTP sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
