import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkRequest {
  userId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId }: LinkRequest = await req.json();
    
    console.log('[BULK-LINK] Starting for user:', userId);
    
    let totalLinksCreated = 0;
    let totalProcessed = 0;
    let lastId: string | null = null;
    let hasMore = true;
    let batchNumber = 0;
    
    const BATCH_SIZE = 100;
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (hasMore) {
            batchNumber++;
            
            const { data, error } = await supabase.rpc(
              'bulk_create_product_links_cursor',
              {
                p_user_id: userId,
                p_limit: BATCH_SIZE,
                p_after: lastId
              }
            );
            
            if (error) {
              console.error('[BULK-LINK] Batch error:', error);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  error: error.message 
                })}\n\n`)
              );
              break;
            }
            
            const result = data[0];
            totalLinksCreated += result.links_created;
            totalProcessed += result.processed_count;
            lastId = result.last_id;
            hasMore = result.has_more;
            
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                batch: batchNumber,
                linksCreated: result.links_created,
                totalLinks: totalLinksCreated,
                totalProcessed: totalProcessed,
                hasMore: hasMore,
                progress: hasMore ? null : 100
              })}\n\n`)
            );
            
            console.log(`[BULK-LINK] Batch ${batchNumber}: +${result.links_created} links (total: ${totalLinksCreated})`);
            
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Execute global merge after all batches complete
          console.log('[BULK-LINK] All links created, starting global merge...');
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              merging: true
            })}\n\n`)
          );

          const { data: mergeResult, error: mergeError } = await supabase
            .rpc('merge_existing_links');

          if (mergeError) {
            console.error('[BULK-LINK] Merge error:', mergeError);
          } else {
            console.log('[BULK-LINK] Merge completed:', mergeResult);
          }
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              complete: true,
              totalLinks: totalLinksCreated,
              totalProcessed: totalProcessed,
              batches: batchNumber,
              merged: mergeResult?.supplier_links_merged || 0
            })}\n\n`)
          );
          
          controller.close();
        } catch (error) {
          console.error('[BULK-LINK] Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              error: error instanceof Error ? error.message : 'Stream error'
            })}\n\n`)
          );
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('[BULK-LINK] Error:', error);
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
