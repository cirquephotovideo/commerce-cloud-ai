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

    const { supplierId, batchNumber = 0, batchSize = 10000 } = await req.json();

    console.log(`[BATCH-IMPORT] Starting batch ${batchNumber} for supplier ${supplierId}`);

    // Call supplier-sync-ftp with offset
    const { data, error } = await supabase.functions.invoke('supplier-sync-ftp', {
      body: {
        supplierId,
        offset: batchNumber * batchSize,
        limit: batchSize,
      }
    });

    if (error) throw error;

    // If more products to process, schedule next batch
    if (data.found === batchSize) {
      console.log(`[BATCH-IMPORT] More products to process, scheduling next batch`);
      
      // Call recursively (via HTTP to avoid stack overflow)
      await supabase.functions.invoke('supplier-import-batch', {
        body: {
          supplierId,
          batchNumber: batchNumber + 1,
          batchSize,
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchNumber,
        processed: data.imported + data.matched,
        totalProcessed: (batchNumber + 1) * batchSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[BATCH-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
