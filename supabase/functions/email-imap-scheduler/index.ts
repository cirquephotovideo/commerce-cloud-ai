import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[EMAIL-IMAP-SCHEDULER] Starting scheduled IMAP polling...');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Récupérer tous les fournisseurs avec mode IMAP/POP3 actif
    const { data: suppliers, error } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('is_active', true)
      .eq('supplier_type', 'email')
      .not('connection_config->email_mode', 'is', null);
    
    console.log('[SCHEDULER] Suppliers found:', suppliers?.map(s => ({
      id: s.id,
      name: s.supplier_name,
      email_mode: s.connection_config?.email_mode,
      imap_host: s.connection_config?.imap_host
    })));

    if (error) {
      console.error('[SCHEDULER] Error fetching suppliers:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log(`[SCHEDULER] Found ${suppliers?.length || 0} suppliers with email polling enabled`);

    // Appeler le poller pour chaque fournisseur
    const results = [];
    for (const supplier of suppliers || []) {
      try {
        console.log(`[SCHEDULER] Triggering poll for ${supplier.supplier_name}...`);
        
        const { data, error: pollError } = await supabase.functions.invoke('email-imap-poller', {
          body: { supplierId: supplier.id }
        });

        if (pollError) {
          console.error(`[SCHEDULER] Error polling ${supplier.supplier_name}:`, pollError);
          results.push({
            supplier_id: supplier.id,
            supplier_name: supplier.supplier_name,
            status: 'error',
            error: pollError.message
          });
        } else {
          results.push({
            supplier_id: supplier.id,
            supplier_name: supplier.supplier_name,
            status: 'success',
            ...data
          });
        }
      } catch (error) {
        console.error(`[SCHEDULER] Exception polling ${supplier.supplier_name}:`, error);
        results.push({
          supplier_id: supplier.id,
          supplier_name: supplier.supplier_name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      polled: suppliers?.length || 0,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[SCHEDULER] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
