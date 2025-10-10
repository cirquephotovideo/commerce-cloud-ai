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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[AUTO-SYNC] Starting automatic supplier synchronization...');

    // Récupérer tous les fournisseurs actifs (sauf type 'file')
    const { data: suppliers, error: fetchError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('is_active', true)
      .neq('supplier_type', 'file');

    if (fetchError) {
      console.error('[AUTO-SYNC] Error fetching suppliers:', fetchError);
      throw fetchError;
    }

    console.log(`[AUTO-SYNC] Found ${suppliers?.length || 0} active suppliers to sync`);

    const results = [];

    for (const supplier of suppliers || []) {
      console.log(`[AUTO-SYNC] Processing supplier: ${supplier.supplier_name} (${supplier.supplier_type})`);
      
      try {
        let functionName = '';
        let payload: any = {};
        let platformConfig = null;

        // Pour les types nécessitant une config plateforme, la récupérer
        const needsPlatformConfig = ['prestashop', 'woocommerce', 'magento', 'shopify', 'odoo'];
        
        if (needsPlatformConfig.includes(supplier.supplier_type)) {
          const { data: configData } = await supabase
            .from('platform_configurations')
            .select('*')
            .eq('user_id', supplier.user_id)
            .eq('platform_type', supplier.supplier_type)
            .eq('is_active', true)
            .maybeSingle();
          
          platformConfig = configData;
          
          if (!platformConfig) {
            console.log(`[AUTO-SYNC] ⚠️ ${supplier.supplier_name}: Configuration plateforme manquante`);
            results.push({
              supplier: supplier.supplier_name,
              status: 'warning',
              message: 'Configuration plateforme manquante'
            });
            continue;
          }
        }

        // Déterminer la fonction à appeler selon le type
        switch (supplier.supplier_type) {
          case 'ftp':
          case 'sftp':
            functionName = 'supplier-sync-ftp';
            payload = { supplierId: supplier.id };
            break;
          
          case 'api':
            functionName = 'supplier-sync-api';
            payload = { supplierId: supplier.id };
            break;
          
          case 'prestashop':
            functionName = 'import-from-prestashop';
            payload = { 
              supplier_id: supplier.id,
              config: platformConfig
            };
            break;
          
          case 'woocommerce':
            functionName = 'import-from-woocommerce';
            payload = { 
              supplier_id: supplier.id,
              config: platformConfig
            };
            break;
          
          case 'magento':
            functionName = 'import-from-magento';
            payload = { 
              supplier_id: supplier.id,
              config: platformConfig
            };
            break;
          
          case 'shopify':
            functionName = 'import-from-shopify';
            payload = { 
              supplier_id: supplier.id,
              config: platformConfig
            };
            break;
          
          case 'odoo':
            functionName = 'import-from-odoo';
            payload = { 
              supplier_id: supplier.id,
              config: platformConfig
            };
            break;
          
          default:
            console.log(`[AUTO-SYNC] Type non supporté: ${supplier.supplier_type}`);
            results.push({
              supplier: supplier.supplier_name,
              status: 'warning',
              message: `Type non supporté: ${supplier.supplier_type}`
            });
            continue;
        }

        // Appeler la fonction de synchronisation
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: payload
        });

        if (error) {
          console.error(`[AUTO-SYNC] Error syncing ${supplier.supplier_name}:`, error);
          results.push({
            supplier: supplier.supplier_name,
            status: 'error',
            error: error.message
          });
        } else {
          console.log(`[AUTO-SYNC] Successfully synced ${supplier.supplier_name}:`, data);
          results.push({
            supplier: supplier.supplier_name,
            status: 'success',
            imported: data.imported || 0,
            matched: data.matched || 0
          });

          // Mettre à jour last_sync_at
          await supabase
            .from('supplier_configurations')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', supplier.id);
        }

      } catch (err: any) {
        console.error(`[AUTO-SYNC] Exception for ${supplier.supplier_name}:`, err);
        results.push({
          supplier: supplier.supplier_name,
          status: 'error',
          error: err.message
        });
      }
    }

    console.log('[AUTO-SYNC] Synchronization complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        suppliers_processed: suppliers?.length || 0,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[AUTO-SYNC] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
