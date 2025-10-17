import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkRequest {
  job_id: string;
  user_id: string;
  supplier_id: string;
  ndjson_path: string;
  mapping: Record<string, number | null>;
  headers: string[];
  skip_config?: {
    skip_rows_top?: number;
    skip_rows_bottom?: number;
    skip_patterns?: string[];
  };
  excluded_columns?: string[];
  offset: number;
  limit: number;
  correlation_id?: string;
  retry_count?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      job_id, user_id, supplier_id, ndjson_path, mapping, headers,
      skip_config = {},
      excluded_columns = [],
      offset, limit,
      correlation_id = crypto.randomUUID(),
      retry_count = 0
    }: ChunkRequest = await req.json();
    
    console.log(`[IMPORT-CHUNK][${correlation_id}] Starting chunk:`, { 
      job_id, offset, limit, retry: retry_count,
      skip_config,
      excluded_columns
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download NDJSON from storage with retry on failure
    let ndjsonFile: Blob | null = null;
    let downloadAttempts = 0;
    const maxDownloadRetries = 3;

    while (downloadAttempts < maxDownloadRetries && !ndjsonFile) {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(ndjson_path);

      if (error) {
        downloadAttempts++;
        console.warn(`[IMPORT-CHUNK][${correlation_id}] Download attempt ${downloadAttempts} failed:`, error);
        if (downloadAttempts >= maxDownloadRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * downloadAttempts)); // Backoff
      } else {
        ndjsonFile = data;
      }
    }

    if (!ndjsonFile) throw new Error('Failed to download NDJSON after retries');

    // Parse NDJSON (newline-delimited JSON)
    const text = await ndjsonFile.text();
    const allLines = text.split('\n').filter(l => l.trim());
    const chunk = allLines.slice(offset, offset + limit);

    console.log(`[IMPORT-CHUNK][${correlation_id}] Processing ${chunk.length} lines (${offset} to ${offset + chunk.length})`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const supplierProductsToUpsert: any[] = [];
    const productAnalysesToCheck: string[] = []; // EANs to check

    // Process each line in chunk
    for (const line of chunk) {
      try {
        const normalized = JSON.parse(line);

        // Skip if no ref and no name
        if (!normalized.supplier_reference && !normalized.product_name) {
          skippedCount++;
          continue;
        }

        // Generate fallback ref if missing
        const supplierRef = normalized.supplier_reference || 
          `AUTO_${normalized.product_name?.substring(0, 20).replace(/\s/g, '_').toUpperCase() || 'UNKNOWN'}`;

        // Prepare supplier_product
        supplierProductsToUpsert.push({
          user_id,
          supplier_id,
          supplier_reference: supplierRef,
          name: normalized.product_name || supplierRef,
          ean: normalized.ean,
          brand: normalized.brand,
          category: normalized.category,
          purchase_price: normalized.purchase_price,
          stock_quantity: normalized.stock_quantity,
          vat_rate: normalized.vat_rate,
          last_sync_at: new Date().toISOString()
        });

        if (normalized.ean) {
          productAnalysesToCheck.push(normalized.ean);
        }

        successCount++;
      } catch (err) {
        console.error('[IMPORT-CHUNK] Line parse error:', err);
        errorCount++;
      }
    }

    // Batch upsert supplier_products
    if (supplierProductsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('supplier_products')
        .upsert(supplierProductsToUpsert, {
          onConflict: 'supplier_id,supplier_reference',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error(`[IMPORT-CHUNK][${correlation_id}] Upsert error:`, upsertError);
        throw upsertError;
      }

      console.log(`[IMPORT-CHUNK][${correlation_id}] Upserted ${supplierProductsToUpsert.length} supplier_products`);
    }

    // Batch update/create product_analyses
    if (productAnalysesToCheck.length > 0) {
      const uniqueEANs = [...new Set(productAnalysesToCheck)];

      // Fetch existing analyses
      const { data: existingAnalyses } = await supabase
        .from('product_analyses')
        .select('id, ean, purchase_price')
        .eq('user_id', user_id)
        .in('ean', uniqueEANs);

      const existingMap = new Map(
        (existingAnalyses || []).map(a => [a.ean, a])
      );

      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const sp of supplierProductsToUpsert) {
        if (!sp.ean) continue;

        const existing = existingMap.get(sp.ean);
        if (existing) {
          // Update purchase_price if different
          if (sp.purchase_price && existing.purchase_price !== sp.purchase_price) {
            toUpdate.push({
              id: existing.id,
              purchase_price: sp.purchase_price
            });
          }
        } else {
          // Create new analysis
          toInsert.push({
            user_id,
            ean: sp.ean,
            product_name: sp.name,
            purchase_price: sp.purchase_price,
            analysis_result: {
              basic_info: {
                name: sp.name,
                brand: sp.brand,
                category: sp.category
              }
            }
          });
        }
      }

      // Batch update
      if (toUpdate.length > 0) {
        for (const update of toUpdate) {
          await supabase
            .from('product_analyses')
            .update({ purchase_price: update.purchase_price })
            .eq('id', update.id);
        }
        console.log(`[IMPORT-CHUNK] Updated ${toUpdate.length} product_analyses`);
      }

      // Batch insert
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('product_analyses')
          .insert(toInsert);

        if (insertError) {
          console.error(`[IMPORT-CHUNK][${correlation_id}] Insert analyses error:`, insertError);
        } else {
          console.log(`[IMPORT-CHUNK][${correlation_id}] Inserted ${toInsert.length} new product_analyses`);
        }
      }
    }

    // Update job progress
    const { data: job } = await supabase
      .from('import_jobs')
      .select('progress_current, products_imported, products_errors')
      .eq('id', job_id)
      .single();

    if (job) {
      const newProcessed = (job.progress_current || 0) + chunk.length;
      const newSuccess = (job.products_imported || 0) + successCount;
      const newErrors = (job.products_errors || 0) + errorCount;

      await supabase
        .from('import_jobs')
        .update({
          progress_current: newProcessed,
          products_imported: newSuccess,
          products_errors: newErrors,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      console.log(`[IMPORT-CHUNK][${correlation_id}] Updated job: ${newProcessed} processed, ${newSuccess} success, ${newErrors} errors`);

      // If more lines remain, chain next invocation
      if (offset + limit < allLines.length) {
        console.log(`[IMPORT-CHUNK][${correlation_id}] Chaining next chunk: offset ${offset + limit}`);
        
        // Invoke next chunk with same correlation_id for traceability
        supabase.functions.invoke('email-import-chunk', {
          body: {
            job_id,
            user_id,
            supplier_id,
            ndjson_path,
            mapping,
            headers,
            skip_config,
            excluded_columns,
            offset: offset + limit,
            limit,
            correlation_id,
            retry_count: 0 // Reset retry count for new chunk
          }
        }).catch(err => console.error(`[IMPORT-CHUNK][${correlation_id}] Chain error:`, err));
      } else {
        // Mark job as completed and update inbox status
        await supabase
          .from('import_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job_id);

        // Update inbox status to completed
        const { data: jobMeta } = await supabase
          .from('import_jobs')
          .select('metadata')
          .eq('id', job_id)
          .single();

        if (jobMeta?.metadata?.inbox_id) {
          await supabase
            .from('email_inbox')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              products_created: newSuccess,
              products_updated: 0,
              products_found: newSuccess
            })
            .eq('id', jobMeta.metadata.inbox_id);
        }

        console.log(`[IMPORT-CHUNK][${correlation_id}] Job completed successfully`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: chunk.length,
      success_count: successCount,
      error_count: errorCount,
      skipped_count: skippedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    const { job_id, correlation_id = 'unknown', retry_count = 0 } = await req.json().catch(() => ({}));
    console.error(`[IMPORT-CHUNK][${correlation_id}] Error (retry ${retry_count}):`, error);

    // Retry logic (max 3 attempts)
    if (retry_count < 3) {
      console.log(`[IMPORT-CHUNK][${correlation_id}] Retrying chunk... (attempt ${retry_count + 1})`);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const body = await req.json();
      supabase.functions.invoke('email-import-chunk', {
        body: {
          ...body,
          retry_count: retry_count + 1
        }
      }).catch(err => console.error(`[IMPORT-CHUNK][${correlation_id}] Retry invocation error:`, err));

      return new Response(JSON.stringify({ 
        error: error.message,
        retry_scheduled: true,
        retry_count: retry_count + 1
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202 // Accepted for retry
      });
    }

    // Max retries exceeded - mark job as failed
    if (job_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('import_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            error: error.message,
            failed_at_correlation_id: correlation_id
          }
        })
        .eq('id', job_id);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      max_retries_exceeded: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
