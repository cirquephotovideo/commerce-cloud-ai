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

    console.log('[AUTO-EXPORT] Starting auto-export manager');

    // Get all enabled export rules
    const { data: exportRules, error: rulesError } = await supabase
      .from('auto_export_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesError) {
      throw new Error(`Failed to fetch export rules: ${rulesError.message}`);
    }

    console.log(`[AUTO-EXPORT] Found ${exportRules?.length || 0} active export rules`);

    const results = [];

    for (const rule of exportRules || []) {
      try {
        // Build query based on conditions
        let query = supabase
          .from('product_analyses')
          .select('*, supplier_products(*)')
          .eq('user_id', rule.user_id)
          .eq('enrichment_status', 'completed');

        // Check if product hasn't been exported yet or needs re-export
        if (rule.sync_frequency === 'on_new') {
          query = query.is('last_exported_at', null);
        }

        // Apply conditions from rule
        const conditions = rule.conditions as any;
        if (conditions.min_margin) {
          query = query.gte('margin_percentage', conditions.min_margin);
        }
        if (conditions.categories && Array.isArray(conditions.categories)) {
          query = query.in('category', conditions.categories);
        }
        if (conditions.min_stock) {
          query = query.gte('supplier_products.stock_quantity', conditions.min_stock);
        }

        const { data: products, error: productsError } = await query;

        if (productsError) {
          console.error(`[AUTO-EXPORT] Error fetching products for rule ${rule.id}:`, productsError);
          continue;
        }

        if (!products || products.length === 0) {
          console.log(`[AUTO-EXPORT] No products to export for rule ${rule.id}`);
          continue;
        }

        console.log(`[AUTO-EXPORT] Exporting ${products.length} products to ${rule.platform_type}`);

        // Call appropriate export function
        const exportFunctionName = `export-to-${rule.platform_type.toLowerCase().replace('_', '-')}`;
        
        const { data: exportResult, error: exportError } = await supabase.functions.invoke(
          exportFunctionName,
          {
            body: {
              products: products.map(p => ({
                id: p.id,
                name: p.supplier_products?.name,
                ean: p.supplier_products?.ean,
                purchase_price: p.supplier_products?.purchase_price,
                analysis_result: p.analysis_result
              }))
            }
          }
        );

        if (exportError) {
          console.error(`[AUTO-EXPORT] Export error for ${rule.platform_type}:`, exportError);
          continue;
        }

        // Update products with export timestamp
        const productIds = products.map(p => p.id);
        await supabase
          .from('product_analyses')
          .update({
            last_exported_at: new Date().toISOString(),
            exported_to_platforms: supabase.rpc('array_append', {
              arr: 'exported_to_platforms',
              elem: rule.platform_type
            })
          })
          .in('id', productIds);

        // Update export rule stats
        await supabase
          .from('auto_export_rules')
          .update({
            last_sync_at: new Date().toISOString(),
            products_exported: (rule.products_exported || 0) + products.length
          })
          .eq('id', rule.id);

        // Send success alert
        await supabase.functions.invoke('send-user-alert', {
          body: {
            userId: rule.user_id,
            alertType: 'export_complete',
            severity: 'info',
            title: 'Export automatique terminé',
            message: `${products.length} produit(s) ont été exportés vers ${rule.platform_type}.`,
            actionUrl: '/import-export-dashboard',
            sendEmail: false
          }
        });

        results.push({
          rule_id: rule.id,
          platform: rule.platform_type,
          products_exported: products.length,
          status: 'success'
        });

      } catch (error) {
        console.error(`[AUTO-EXPORT] Error processing rule ${rule.id}:`, error);
        results.push({
          rule_id: rule.id,
          platform: rule.platform_type,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[AUTO-EXPORT] Auto-export completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} export rules`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTO-EXPORT] Fatal error:', error);
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
