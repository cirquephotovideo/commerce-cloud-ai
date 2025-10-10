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

    console.log('[SYNC-SCHEDULER] Starting supplier sync scheduler');

    // Get all active suppliers that need syncing
    const { data: suppliers, error: suppliersError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('is_active', true);

    if (suppliersError) {
      throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`);
    }

    console.log(`[SYNC-SCHEDULER] Found ${suppliers?.length || 0} active suppliers`);

    const results = [];

    for (const supplier of suppliers || []) {
      const startTime = Date.now();
      
      try {
        // Create/update sync schedule entry
        const { data: schedule, error: scheduleError } = await supabase
          .from('supplier_sync_schedule')
          .upsert({
            supplier_id: supplier.id,
            sync_status: 'running',
            next_sync_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next sync in 24h
          }, {
            onConflict: 'supplier_id'
          })
          .select()
          .single();

        if (scheduleError) {
          console.error(`[SYNC-SCHEDULER] Error creating schedule for ${supplier.name}:`, scheduleError);
          continue;
        }

        // Call appropriate sync function based on supplier type
        let syncResult;
        switch (supplier.supplier_type) {
          case 'ftp':
          case 'sftp':
            syncResult = await supabase.functions.invoke('supplier-sync-ftp', {
              body: { supplierId: supplier.id }
            });
            break;
          case 'api':
            syncResult = await supabase.functions.invoke('supplier-sync-api', {
              body: { supplierId: supplier.id }
            });
            break;
          case 'file':
            console.log(`[SYNC-SCHEDULER] Skipping file-based supplier ${supplier.name} - manual sync required`);
            continue;
          default:
            console.log(`[SYNC-SCHEDULER] Unsupported supplier type: ${supplier.supplier_type}`);
            continue;
        }

        const syncDuration = Date.now() - startTime;

        // Update schedule with results
        const { error: updateError } = await supabase
          .from('supplier_sync_schedule')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: syncResult.error ? 'failed' : 'completed',
            sync_duration_ms: syncDuration,
            error_message: syncResult.error ? JSON.stringify(syncResult.error) : null,
          })
          .eq('id', schedule.id);

        if (updateError) {
          console.error(`[SYNC-SCHEDULER] Error updating schedule:`, updateError);
        }

        // Update supplier last_synced_at
        await supabase
          .from('supplier_configurations')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', supplier.id);

        results.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          status: syncResult.error ? 'failed' : 'success',
          duration_ms: syncDuration,
          error: syncResult.error || null
        });

      } catch (error) {
        console.error(`[SYNC-SCHEDULER] Error syncing supplier ${supplier.name}:`, error);
        results.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[SYNC-SCHEDULER] Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.length} suppliers`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC-SCHEDULER] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
