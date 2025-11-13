import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractField(columns: string[], mapping: any): string | null {
  if (mapping === null || mapping === undefined) return null;
  
  // Handle numeric index
  if (typeof mapping === 'number') {
    return columns[mapping] ?? null;
  }
  
  // Handle string index
  if (typeof mapping === 'string') {
    const index = parseInt(mapping, 10);
    return isNaN(index) ? null : (columns[index] ?? null);
  }
  
  // Handle object with fields array
  if (typeof mapping === 'object' && Array.isArray(mapping.fields)) {
    return mapping.fields
      .map((f: any) => {
        const idx = typeof f === 'number' ? f : (typeof f.index === 'number' ? f.index : parseInt(String(f.index || f), 10));
        return isNaN(idx) ? null : columns[idx];
      })
      .filter(Boolean)
      .join(' ');
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { supplierId, filePath, delimiter, skipRows, columnMapping, hasHeaderRow = true } = await req.json();

    console.log('[IMPORT-CSV] Starting import for user:', user.id);
    console.log('[IMPORT-CSV] File path:', filePath);
    console.log('[IMPORT-CSV] Mapping types:', Object.keys(columnMapping).reduce((acc, key) => {
      acc[key] = typeof columnMapping[key];
      return acc;
    }, {} as Record<string, string>));
    console.log('[IMPORT-CSV] Skip rows:', skipRows, '| Has header:', hasHeaderRow);

    // 1. Download file from Storage
    console.log('[IMPORT-CSV] Downloading file from Storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('[IMPORT-CSV] Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const fileSize = fileData.size;
    console.log('[IMPORT-CSV] File downloaded:', {
      size_mb: (fileSize / 1024 / 1024).toFixed(2),
      type: fileData.type
    });

    // 2. Stream file content line by line
    console.log('[IMPORT-CSV] Starting streaming processing...');
    const reader = fileData.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lineNumber = 0;
    let processedCount = 0;
    let currentBatch: string[] = [];
    let batchNumber = 1;
    let headerRow: string[] = [];
    let detectedDelimiter = delimiter || ',';
    const jobId = crypto.randomUUID();

    // Helper function to write batch to storage
    async function writeBatchToStorage(batch: string[], batchNum: number) {
      if (batch.length === 0) return;
      
      const batchPath = `${user.id}/${jobId}_batch${batchNum}.ndjson`;
      const batchContent = batch.join('\n') + '\n';
      
      const { error: batchError } = await supabase.storage
        .from('supplier-imports')
        .upload(batchPath, batchContent, {
          contentType: 'application/x-ndjson',
          upsert: false
        });
      
      if (batchError) {
        throw new Error(`Failed to write batch ${batchNum}: ${batchError.message}`);
      }
      
      console.log(`[IMPORT-CSV] Batch ${batchNum} written (${batch.length} lines)`);
    }

    // Stream processing loop
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const line = buffer.trim();
            lineNumber++;
            
            if (lineNumber > (skipRows || 0) + 1) {
              const columns = line.split(detectedDelimiter).map(col => {
                let cleaned = col.trim().replace(/^["']|["']$/g, '');
                return decodeHtmlEntities(cleaned);
              });

              const reference = extractField(columns, columnMapping.supplier_reference);
              const name = extractField(columns, columnMapping.product_name);

              if (reference && name) {
                const ean = extractField(columns, columnMapping.ean);
                const description = extractField(columns, columnMapping.description);
                
                let purchase_price = null;
                const priceStr = extractField(columns, columnMapping.purchase_price);
                if (priceStr) {
                  const normalizedPrice = priceStr.replace(/[^\d.,]/g, '').replace(',', '.');
                  purchase_price = parseFloat(normalizedPrice);
                }

                let stock = null;
                const stockStr = extractField(columns, columnMapping.stock);
                if (stockStr) {
                  stock = parseInt(stockStr.replace(/\D/g, ''));
                }

                const productData = {
                  supplier_id: supplierId,
                  user_id: user.id,
                  reference,
                  name,
                  ean: ean || null,
                  description: description || null,
                  purchase_price: purchase_price || null,
                  stock: stock || null,
                  currency: 'EUR',
                  brand: extractField(columns, columnMapping.brand) || null,
                  category: extractField(columns, columnMapping.category) || null,
                  last_sync_at: new Date().toISOString()
                };

                currentBatch.push(JSON.stringify(productData));
                processedCount++;
              }
            }
          }
          break;
        }
        
        // Add chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          lineNumber++;
          const trimmedLine = line.trim();
          
          if (!trimmedLine) continue;
          
          // Skip initial rows
          if (lineNumber <= (skipRows || 0)) continue;
          
          // Header row (only if file has header)
          if (hasHeaderRow && lineNumber === (skipRows || 0) + 1) {
            // Auto-detect delimiter from header
            if (!delimiter) {
              detectedDelimiter = trimmedLine.includes('\t') ? '\t' : (trimmedLine.includes(';') ? ';' : ',');
            }
            headerRow = trimmedLine.split(detectedDelimiter).map(h => h.trim());
            console.log('[IMPORT-CSV] Header row:', headerRow);
            console.log('[IMPORT-CSV] Using delimiter:', detectedDelimiter);
            continue;
          }
          
          // Auto-detect delimiter from first data line if no header
          if (!hasHeaderRow && lineNumber === (skipRows || 0) + 1 && !delimiter) {
            detectedDelimiter = trimmedLine.includes('\t') ? '\t' : (trimmedLine.includes(';') ? ';' : ',');
            console.log('[IMPORT-CSV] No header - detected delimiter:', detectedDelimiter);
          }
          
          // Parse data row
          const columns = trimmedLine.split(detectedDelimiter).map(col => {
            let cleaned = col.trim().replace(/^["']|["']$/g, '');
            return decodeHtmlEntities(cleaned);
          });

          const rawRef = extractField(columns, columnMapping.supplier_reference);
          const name = extractField(columns, columnMapping.product_name);
          const ean = extractField(columns, columnMapping.ean);

          // Accept row if it has at least a name
          if (!name && !rawRef && !ean) {
            continue;
          }
          
          // Deduce reference from EAN or name if not provided
          const reference = rawRef || ean || (name ? String(name).slice(0, 64) : null);

          const description = extractField(columns, columnMapping.description);
          
          // Parse price
          let purchase_price = null;
          const priceStr = extractField(columns, columnMapping.purchase_price);
          if (priceStr) {
            const normalizedPrice = priceStr.replace(/[^\d.,]/g, '').replace(',', '.');
            purchase_price = parseFloat(normalizedPrice);
          }

          // Parse stock
          let stock = null;
          const stockStr = extractField(columns, columnMapping.stock ?? columnMapping.stock_quantity);
          if (stockStr) {
            stock = parseInt(stockStr.replace(/\D/g, ''));
          }

          const productData = {
            supplier_id: supplierId,
            user_id: user.id,
            reference,
            name,
            ean: ean || null,
            description: description || null,
            purchase_price: purchase_price || null,
            stock: stock || null,
            currency: 'EUR',
            brand: extractField(columns, columnMapping.brand) || null,
            category: extractField(columns, columnMapping.category) || null,
            last_sync_at: new Date().toISOString()
          };

          currentBatch.push(JSON.stringify(productData));
          processedCount++;

          // Write batch every 1000 products
          if (currentBatch.length >= 1000) {
            await writeBatchToStorage(currentBatch, batchNumber);
            currentBatch = [];
            batchNumber++;
            console.log(`[IMPORT-CSV] Processed ${processedCount} products...`);
          }
        }
      }
      
      // Write final batch
      if (currentBatch.length > 0) {
        await writeBatchToStorage(currentBatch, batchNumber);
        batchNumber++;
      }
      
      console.log('[IMPORT-CSV] ===== STREAMING COMPLETE =====');
      console.log('[IMPORT-CSV] Total lines read:', lineNumber);
      console.log('[IMPORT-CSV] Skip rows configured:', skipRows, '| Has header:', hasHeaderRow);
      console.log('[IMPORT-CSV] Products extracted:', processedCount);
      console.log('[IMPORT-CSV] Total batches written:', batchNumber - 1);
      console.log('[IMPORT-CSV] ===========================');
      
      // Diagnostic if no products detected
      if (processedCount === 0) {
        console.error('[IMPORT-CSV] ⚠️ 0 products processed!');
        console.error('[IMPORT-CSV] Mapping:', JSON.stringify(columnMapping, null, 2));
        console.error('[IMPORT-CSV] Has header:', hasHeaderRow, '| Skip rows:', skipRows);
        console.error('[IMPORT-CSV] Total lines read:', lineNumber);
        console.error('[IMPORT-CSV] Mapping types:', Object.keys(columnMapping).reduce((acc: Record<string, string>, key) => {
          acc[key] = typeof columnMapping[key];
          return acc;
        }, {}));
      }
      
    } finally {
      reader.releaseLock();
    }

    // 3. List batch files (no concatenation to save memory)
    console.log('[IMPORT-CSV] Listing batch files...');
    const { data: files, error: listError } = await supabase.storage
      .from('supplier-imports')
      .list(user.id, { 
        search: `${jobId}_batch`
      });
    
    if (listError) {
      throw new Error(`Failed to list batch files: ${listError.message}`);
    }
    
    const sortedFiles = (files || [])
      .filter(f => f.name.startsWith(`${jobId}_batch`))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/batch(\d+)/)?.[1] || '0');
        const numB = parseInt(b.name.match(/batch(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    console.log('[IMPORT-CSV] Found batches:', sortedFiles.length);

    // 4. Create import job
    console.log('[IMPORT-CSV] Creating import job with:', {
      products: processedCount,
      batches: sortedFiles.length,
      skipRows,
      hasColumnMapping: !!columnMapping
    });
    
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        supplier_id: supplierId,
        status: 'processing',
        progress_total: processedCount,
        progress_current: 0,
        metadata: {
          batches: sortedFiles.map(f => f.name),
          source_file: filePath,
          delimiter: delimiter,
          skip_rows: skipRows,
          column_mapping: columnMapping
        }
      })
      .select()
      .single();

    if (jobError) {
      console.error('[IMPORT-CSV] Job creation error:', jobError);
      throw new Error(`Failed to create import job: ${jobError.message}`);
    }

    console.log('[IMPORT-CSV] Import job created:', job.id);

    // 5. Process each batch sequentially to avoid memory issues
    let totalProcessed = 0;
    for (let i = 0; i < sortedFiles.length; i++) {
      const batchPath = `${user.id}/${sortedFiles[i].name}`;
      console.log(`[IMPORT-CSV] Processing batch ${i + 1}/${sortedFiles.length}: ${batchPath}`);
      
      const { error: chunkError } = await supabase.functions.invoke('email-import-chunk', {
        body: {
          job_id: job.id,
          ndjson_path: batchPath,
          user_id: user.id,
          supplier_id: supplierId,
          mapping: columnMapping,
          headers: Object.keys(columnMapping),
          skip_config: {},
          excluded_columns: [],
          offset: 0,
          limit: 1000
        }
      });

      if (chunkError) {
        console.error(`[IMPORT-CSV] Batch ${i + 1} processing error:`, chunkError);
        await supabase
          .from('import_jobs')
          .update({ 
            status: 'failed', 
            error_message: `Failed at batch ${i + 1}: ${chunkError.message}` 
          })
          .eq('id', job.id);
        
        throw new Error(`Failed to process batch ${i + 1}: ${chunkError.message}`);
      }
      
      totalProcessed += 1000;
      console.log(`[IMPORT-CSV] Batch ${i + 1} queued successfully`);
    }
    
    console.log('[IMPORT-CSV] All batches queued for processing');

    // 6. Log the import
    await supabase.from('supplier_import_logs').insert({
      user_id: user.id,
      supplier_id: supplierId,
      file_name: filePath.split('/').pop(),
      file_size_kb: Math.round(fileSize / 1024),
      products_imported: 0,
      status: 'started',
      import_source: 'csv_upload'
    });

    console.log('[IMPORT-CSV] Import started successfully, processing in chunks');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import démarré avec succès. ${processedCount} produits en cours de traitement par morceaux.`,
        jobId: job.id,
        productsQueued: processedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMPORT-CSV] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Voir les logs pour plus de détails'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});