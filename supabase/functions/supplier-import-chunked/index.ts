import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkJob {
  id: string;
  user_id: string;
  supplier_id: string;
  file_path: string;
  total_rows: number;
  processed_rows: number;
  current_chunk: number;
  chunk_size: number;
  skip_rows: number;
  column_mapping: any;
  status: 'processing' | 'completed' | 'failed';
  matched: number;
  new_products: number;
  failed: number;
  created_at?: string;
  updated_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId, supplierId, filePath, skipRows = 1, columnMapping = {}, chunkIndex = 0 } = await req.json();

    console.log('[CHUNKED-IMPORT] Processing:', { jobId, supplierId, chunkIndex });

    // Get or create job
    let job: ChunkJob;
    let dataRows: any[][] | null = null;
    
    if (jobId) {
      const { data: existingJob, error } = await supabase
        .from('supplier_import_chunk_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !existingJob) {
        throw new Error('Job not found');
      }
      job = existingJob;
    } else {
      // First call - download file, count rows and keep data in memory for first chunk
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('supplier-imports')
        .download(filePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      const totalRows = Math.max(0, data.length - skipRows);
      dataRows = skipRows > 0 ? data.slice(skipRows) : data;

      // Get user ID from auth
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer', '').trim() || '';
      const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
      const userId = payload?.sub;

      if (!userId) {
        throw new Error('Authentication failed');
      }

      // Create job
      const { data: newJob, error: createError } = await supabase
        .from('supplier_import_chunk_jobs')
        .insert({
          user_id: userId,
          supplier_id: supplierId,
          file_path: filePath,
          total_rows: totalRows,
          processed_rows: 0,
          current_chunk: 0,
          chunk_size: 100,
          skip_rows: skipRows,
          column_mapping: columnMapping,
          status: 'processing',
          matched: 0,
          new_products: 0,
          failed: 0,
        })
        .select()
        .single();

      if (createError || !newJob) {
        throw new Error('Failed to create job');
      }

      job = newJob;
    }

    // Download and prepare data for this chunk if not already loaded
    if (!dataRows) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('supplier-imports')
        .download(job.file_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      dataRows = job.skip_rows > 0 ? data.slice(job.skip_rows) : data;
    }

    // Process current chunk
    const startIdx = job.current_chunk * job.chunk_size;
    const endIdx = Math.min(startIdx + job.chunk_size, dataRows.length);
    const chunk = dataRows.slice(startIdx, endIdx);

    let chunkMatched = 0;
    let chunkNew = 0;
    let chunkFailed = 0;

    console.log(`[CHUNKED-IMPORT] Processing rows ${startIdx}-${endIdx} of ${dataRows.length}`);

    // Process rows in this chunk
    for (const row of chunk) {
      try {
        const getName = () => {
          if (job.column_mapping.product_name !== null && job.column_mapping.product_name !== undefined) {
            return row[job.column_mapping.product_name];
          }
          return row[2];
        };
        
        const getPrice = () => {
          if (job.column_mapping.purchase_price !== null && job.column_mapping.purchase_price !== undefined) {
            return row[job.column_mapping.purchase_price];
          }
          return row[3];
        };

        const name = getName();
        const price = getPrice();

        if (!name || !price) {
          chunkFailed++;
          continue;
        }

        const productData = {
          user_id: job.user_id,
          supplier_id: job.supplier_id,
          ean: job.column_mapping.ean !== null ? String(row[job.column_mapping.ean] || '') : (row[0] ? String(row[0]) : null),
          supplier_reference: job.column_mapping.supplier_reference !== null ? String(row[job.column_mapping.supplier_reference] || '') : (row[1] ? String(row[1]) : null),
          product_name: String(name),
          purchase_price: parseFloat(String(price).replace(',', '.')),
          stock_quantity: job.column_mapping.stock_quantity !== null ? parseInt(String(row[job.column_mapping.stock_quantity] || 0)) : (row[4] ? parseInt(String(row[4])) : null),
          currency: 'EUR',
          description: job.column_mapping.description !== null ? String(row[job.column_mapping.description] || '') : null,
          category: job.column_mapping.category !== null ? String(row[job.column_mapping.category] || '') : null,
        };

        // Check if product exists
        const { data: existing } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', job.supplier_id)
          .eq('ean', productData.ean)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('supplier_products')
            .update({ ...productData, enrichment_status: 'completed', enrichment_progress: 100 })
            .eq('id', existing.id);
          chunkMatched++;
        } else {
          await supabase
            .from('supplier_products')
            .insert([productData]);
          chunkNew++;
        }
      } catch (error) {
        console.error('[CHUNKED-IMPORT] Row error:', error);
        chunkFailed++;
      }
    }

    // Update job
    const newProcessedRows = job.processed_rows + chunk.length;
    const isComplete = newProcessedRows >= job.total_rows;
    
    await supabase
      .from('supplier_import_chunk_jobs')
      .update({
        processed_rows: newProcessedRows,
        current_chunk: job.current_chunk + 1,
        matched: job.matched + chunkMatched,
        new_products: job.new_products + chunkNew,
        failed: job.failed + chunkFailed,
        status: isComplete ? 'completed' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`[CHUNKED-IMPORT] Chunk complete: ${newProcessedRows}/${job.total_rows} rows`);

    // If not complete, invoke next chunk in background
    if (!isComplete) {
      // Use waitUntil for background processing
      const nextChunkPromise = supabase.functions.invoke('supplier-import-chunked', {
        body: {
          jobId: job.id,
          supplierId: job.supplier_id,
          filePath: job.file_path,
          skipRows: job.skip_rows,
          columnMapping: job.column_mapping,
          chunkIndex: job.current_chunk + 1,
        }
      });

      // @ts-ignore - EdgeRuntime is available in Deno Deploy
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore
        EdgeRuntime.waitUntil(nextChunkPromise);
      }
    } else {
      // Log final import
      await supabase.from('supplier_import_logs').insert({
        user_id: job.user_id,
        supplier_id: job.supplier_id,
        import_type: 'chunked',
        source_file: job.file_path,
        products_found: job.total_rows,
        products_matched: job.matched + chunkMatched,
        products_new: job.new_products + chunkNew,
        products_updated: job.matched + chunkMatched,
        products_failed: job.failed + chunkFailed,
        import_status: 'success',
      });

      // Update supplier last sync
      await supabase
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', job.supplier_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        progress: {
          processed: newProcessedRows,
          total: job.total_rows,
          percentage: Math.round((newProcessedRows / job.total_rows) * 100),
        },
        stats: {
          matched: job.matched + chunkMatched,
          new: job.new_products + chunkNew,
          failed: job.failed + chunkFailed,
        },
        isComplete,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHUNKED-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
