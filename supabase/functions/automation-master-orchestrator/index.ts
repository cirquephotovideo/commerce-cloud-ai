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

    console.log('[ORCHESTRATOR] Starting automation orchestrator...');

    // Fetch active automation rules that should be executed
    const { data: rules, error: fetchError } = await supabase
      .from('automation_master_rules')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', 'schedule')
      .order('priority', { ascending: true });

    if (fetchError) {
      console.error('[ORCHESTRATOR] Error fetching rules:', fetchError);
      throw fetchError;
    }

    console.log(`[ORCHESTRATOR] Found ${rules?.length || 0} active scheduled rules`);

    const results = [];

    for (const rule of rules || []) {
      try {
        console.log(`[ORCHESTRATOR] Evaluating rule: ${rule.rule_name} (${rule.rule_category})`);

        // Check if rule should be executed based on frequency
        const { data: shouldExecute } = await supabase.rpc('should_execute_automation_rule', {
          p_rule_id: rule.id,
          p_trigger_config: rule.trigger_config,
          p_last_triggered_at: rule.last_triggered_at,
        });

        if (!shouldExecute) {
          console.log(`[ORCHESTRATOR] Rule ${rule.rule_name} not ready to execute yet`);
          continue;
        }

        console.log(`[ORCHESTRATOR] Executing rule: ${rule.rule_name}`);

        // Update trigger timestamp
        await supabase
          .from('automation_master_rules')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: rule.trigger_count + 1,
          })
          .eq('id', rule.id);

        // Execute actions based on rule category
        let actionResult = null;

        switch (rule.rule_category) {
          case 'import':
            actionResult = await executeImportAction(supabase, rule);
            break;

          case 'cleanup':
            actionResult = await executeCleanupAction(supabase, rule);
            break;

          case 'enrichment':
            actionResult = await executeEnrichmentAction(supabase, rule);
            break;

          case 'export':
            actionResult = await executeExportAction(supabase, rule);
            break;

          case 'sync':
            actionResult = await executeSyncAction(supabase, rule);
            break;

          case 'linking':
            actionResult = await executeLinkingAction(supabase, rule);
            break;

          default:
            console.log(`[ORCHESTRATOR] Unknown category: ${rule.rule_category}`);
        }

        // Update success stats
        await supabase
          .from('automation_master_rules')
          .update({
            last_success_at: new Date().toISOString(),
            success_count: rule.success_count + 1,
          })
          .eq('id', rule.id);

        results.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          status: 'success',
          result: actionResult,
        });

      } catch (error) {
        console.error(`[ORCHESTRATOR] Error executing rule ${rule.rule_name}:`, error);

        // Update error stats
        await supabase
          .from('automation_master_rules')
          .update({
            last_error_at: new Date().toISOString(),
            last_error_message: error instanceof Error ? error.message : 'Unknown error',
            error_count: rule.error_count + 1,
          })
          .eq('id', rule.id);

        // Handle error based on on_error_action
        if (rule.on_error_action === 'stop') {
          await supabase
            .from('automation_master_rules')
            .update({ is_active: false })
            .eq('id', rule.id);
        }

        if (rule.on_error_action === 'alert') {
          await supabase.functions.invoke('send-user-alert', {
            body: {
              userId: rule.user_id,
              alertType: 'automation_error',
              message: `Erreur dans l'automatisation "${rule.rule_name}": ${error.message}`,
            },
          });
        }

        results.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Wait 1 second between rules to avoid overloading
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[ORCHESTRATOR] Completed. Processed ${results.length} rules`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ORCHESTRATOR] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper functions for each action type
async function executeImportAction(supabase: any, rule: any) {
  console.log(`[IMPORT] Executing import for rule: ${rule.rule_name}`);
  
  if (rule.source_config.supplier_id) {
    const { data, error } = await supabase.functions.invoke('email-imap-poller', {
      body: { supplierId: rule.source_config.supplier_id },
    });
    
    if (error) throw error;
    return data;
  }
  
  return { message: 'Import executed' };
}

async function executeCleanupAction(supabase: any, rule: any) {
  console.log(`[CLEANUP] Executing cleanup for rule: ${rule.rule_name}`);
  
  const { data, error } = await supabase.functions.invoke('cleanup-old-emails', {
    body: { days: rule.cleanup_after_days || 30 },
  });
  
  if (error) throw error;
  return data;
}

async function executeEnrichmentAction(supabase: any, rule: any) {
  console.log(`[ENRICHMENT] Executing enrichment for rule: ${rule.rule_name}`);
  
  const { data, error } = await supabase.functions.invoke('process-pending-enrichments', {
    body: {},
  });
  
  if (error) throw error;
  return data;
}

async function executeExportAction(supabase: any, rule: any) {
  console.log(`[EXPORT] Executing export for rule: ${rule.rule_name}`);
  
  const { data, error } = await supabase.functions.invoke('auto-export-manager', {
    body: {},
  });
  
  if (error) throw error;
  return data;
}

async function executeSyncAction(supabase: any, rule: any) {
  console.log(`[SYNC] Executing sync for rule: ${rule.rule_name}`);
  
  if (rule.source_config.supplier_id) {
    const { data, error } = await supabase.functions.invoke('supplier-sync-single-product', {
      body: { supplierId: rule.source_config.supplier_id },
    });
    
    if (error) throw error;
    return data;
  }
  
  return { message: 'Sync executed' };
}

async function executeLinkingAction(supabase: any, rule: any) {
  console.log(`[LINKING] Executing linking for rule: ${rule.rule_name}`);
  
  const { data, error } = await supabase.functions.invoke('auto-link-products', {
    body: {
      supplierId: rule.source_config.supplier_id,
      threshold: rule.conditions.confidence_threshold || 80,
    },
  });
  
  if (error) throw error;
  return data;
}
