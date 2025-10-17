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
  if (!mapping) return null;
  
  if (typeof mapping === 'string') {
    return columns[parseInt(mapping)] || null;
  }
  
  if (typeof mapping === 'object' && mapping.fields) {
    return mapping.fields.map((f: any) => columns[f.index]).filter(Boolean).join(' ');
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

    const { supplierId, filePath, delimiter, skipRows, columnMapping } = await req.json();

    console.log('[IMPORT-CSV] Starting import for user:', user.id);
    console.log('[IMPORT-CSV] File path:', filePath);

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

    // 2. Read file content
    const text = await fileData.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    console.log('[IMPORT-CSV] Total lines:', lines.length);

    // Auto-detect delimiter if not provided
    const detectedDelimiter = delimiter || (text.includes('\t') ? '\t' : ',');
    console.log('[IMPORT-CSV] Using delimiter:', detectedDelimiter);

    // Parse CSV to NDJSON
    const ndjsonLines: string[] = [];
    let processedCount = 0;
    let headerRow: string[] = [];

    for (let i = skipRows || 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === (skipRows || 0)) {
        headerRow = line.split(detectedDelimiter).map(h => h.trim());
        console.log('[IMPORT-CSV] Header row:', headerRow);
        continue;
      }

      const columns = line.split(detectedDelimiter).map(col => {
        let cleaned = col.trim().replace(/^["']|["']$/g, '');
        return decodeHtmlEntities(cleaned);
      });

      const reference = extractField(columns, columnMapping.supplier_reference);
      const name = extractField(columns, columnMapping.product_name);

      if (!reference || !name) {
        console.warn('[IMPORT-CSV] Skipping row - missing reference or name');
        continue;
      }

      const ean = extractField(columns, columnMapping.ean);
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

      ndjsonLines.push(JSON.stringify(productData));
      processedCount++;

      if (processedCount % 1000 === 0) {
        console.log(`[IMPORT-CSV] Processed ${processedCount} products...`);
      }
    }

    console.log('[IMPORT-CSV] Total products converted to NDJSON:', processedCount);

    // 3. Upload NDJSON to Storage
    const jobId = crypto.randomUUID();
    const ndjsonPath = `${user.id}/${jobId}.ndjson`;
    const ndjsonContent = ndjsonLines.join('\n');

    console.log('[IMPORT-CSV] Uploading NDJSON to Storage:', {
      path: ndjsonPath,
      size_mb: (ndjsonContent.length / 1024 / 1024).toFixed(2),
      lines: ndjsonLines.length
    });

    const { error: uploadError } = await supabase.storage
      .from('supplier-imports')
      .upload(ndjsonPath, ndjsonContent, {
        contentType: 'application/x-ndjson',
        upsert: true
      });

    if (uploadError) {
      console.error('[IMPORT-CSV] NDJSON upload error:', uploadError);
      throw new Error(`Failed to upload NDJSON: ${uploadError.message}`);
    }

    // 4. Create import job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        supplier_id: supplierId,
        status: 'processing',
        total_lines: processedCount,
        processed_lines: 0,
        file_path: ndjsonPath,
        source_type: 'csv_upload'
      })
      .select()
      .single();

    if (jobError) {
      console.error('[IMPORT-CSV] Job creation error:', jobError);
      throw new Error(`Failed to create import job: ${jobError.message}`);
    }

    console.log('[IMPORT-CSV] Import job created:', job.id);

    // 5. Invoke email-import-chunk to process in chunks
    const { error: chunkError } = await supabase.functions.invoke('email-import-chunk', {
      body: {
        jobId: job.id,
        filePath: ndjsonPath,
        userId: user.id,
        supplierId,
        offset: 0,
        limit: 100,
        columnMapping
      }
    });

    if (chunkError) {
      console.error('[IMPORT-CSV] Chunk processing invocation error:', chunkError);
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', error_message: chunkError.message })
        .eq('id', job.id);
      
      throw new Error(`Failed to start chunk processing: ${chunkError.message}`);
    }

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