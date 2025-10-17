import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleError } from '../_shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã', '&auml;': 'ä',
    '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê', '&euml;': 'ë',
    '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î', '&iuml;': 'ï',
    '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ', '&ouml;': 'ö',
    '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û', '&uuml;': 'ü',
    '&ccedil;': 'ç', '&ntilde;': 'ñ',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&euro;': '€', '&pound;': '£', '&yen;': '¥', '&copy;': '©', '&reg;': '®',
  };
  
  return text.replace(/&[a-z]+;/gi, match => entities[match.toLowerCase()] || match);
}

// Helper to extract field with sub-field support
function extractField(columns: string[], mapping: any): string | null {
  if (!mapping) return null;
  
  // Simple column index
  if (typeof mapping === 'number') {
    return columns[mapping] || null;
  }
  
  // Object with col/sub support
  if (typeof mapping === 'object' && mapping.col !== undefined) {
    const cellValue = columns[mapping.col] || '';
    
    // If no sub-field, return whole cell
    if (mapping.sub === undefined) {
      return cellValue.trim();
    }
    
    // Extract sub-field
    const subDelimiter = mapping.subDelimiter || ',';
    const subFields = cellValue.split(subDelimiter).map(s => s.trim());
    return subFields[mapping.sub] || null;
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

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    const { supplierId, fileContent, delimiter: userDelimiter, skipRows = 1, columnMapping = {} } = await req.json();
    
    if (!supplierId || !fileContent) {
      return new Response(
        JSON.stringify({ error: 'Missing supplierId or fileContent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CSV-IMPORT] Starting chunked import', {
      supplier_id: supplierId,
      file_size_mb: (fileContent.length / 1024 / 1024).toFixed(2),
      user_id: user.id,
      skip_rows: skipRows
    });

    // Auto-detect delimiter
    let delimiter = userDelimiter || ';';
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    const lines = cleanContent.split(/\r?\n/).filter((line: string) => line.trim());
    
    if (lines.length > 0) {
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      
      if (commaCount > 3 && commaCount > semicolonCount) {
        delimiter = ',';
      }
      console.log(`[CSV-IMPORT] Detected delimiter: "${delimiter}"`);
    }

    console.log('[CSV-IMPORT] Total lines:', lines.length);

    // Convert CSV to NDJSON for chunked processing
    const ndjsonLines: string[] = [];
    let validProducts = 0;
    let invalidProducts = 0;

    const startIndex = skipRows;
    const dataLines = lines.slice(startIndex);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const columns = line.split(delimiter).map((col: string) => 
          col.trim().replace(/^["']|["']$/g, '')
        );

        // Extract fields using mapping
        const productName = extractField(columns, columnMapping?.product_name) || columns[0] || '';
        const supplierRef = extractField(columns, columnMapping?.supplier_reference) || columns[1] || '';
        const ean = extractField(columns, columnMapping?.ean) || (columns[2] || null);
        
        // Extract price
        let purchasePrice: number | null = null;
        const priceMapping = columnMapping?.purchase_price;
        const priceStr = extractField(columns, priceMapping);
        
        if (priceStr) {
          const decimalSep = (priceMapping && typeof priceMapping === 'object') 
            ? priceMapping.decimal || ',' 
            : ',';
          const normalizedPrice = priceStr.replace(decimalSep, '.');
          const parsed = parseFloat(normalizedPrice);
          if (!isNaN(parsed) && parsed > 0) {
            purchasePrice = parsed;
          }
        }
        
        // Extract stock
        let stockQuantity: number | null = null;
        const stockStr = extractField(columns, columnMapping?.stock_quantity);
        if (stockStr) {
          const parsed = parseInt(stockStr);
          if (!isNaN(parsed)) {
            stockQuantity = parsed;
          }
        }

        // Validate required fields
        if (!supplierRef || !purchasePrice) {
          invalidProducts++;
          continue;
        }

        // Decode HTML entities
        const cleanName = decodeHtmlEntities(productName || supplierRef);

        // Create NDJSON row
        const productData = {
          user_id: user.id,
          supplier_id: supplierId,
          supplier_reference: supplierRef,
          product_name: cleanName,
          ean: ean,
          purchase_price: purchasePrice,
          stock_quantity: stockQuantity,
          currency: 'EUR',
          needs_enrichment: true,
        };

        ndjsonLines.push(JSON.stringify(productData));
        validProducts++;
      } catch (error) {
        console.error(`[CSV-IMPORT] Error parsing line ${i}:`, error);
        invalidProducts++;
      }
    }

    console.log('[CSV-IMPORT] NDJSON conversion completed', {
      valid_products: validProducts,
      invalid_products: invalidProducts
    });

    if (ndjsonLines.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid products found in CSV' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload NDJSON to Storage
    const jobId = crypto.randomUUID();
    const ndjsonContent = ndjsonLines.join('\n');
    const fileName = `imports/${user.id}/${jobId}.ndjson`;

    console.log('[CSV-IMPORT] Uploading NDJSON to storage:', {
      file_name: fileName,
      size_mb: (ndjsonContent.length / 1024 / 1024).toFixed(2)
    });

    const { error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(fileName, ndjsonContent, {
        contentType: 'application/x-ndjson',
        upsert: true
      });

    if (uploadError) {
      console.error('[CSV-IMPORT] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file for processing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create import job
    const { data: jobData, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id: user.id,
        supplier_id: supplierId,
        status: 'processing',
        total_rows: ndjsonLines.length,
        processed_rows: 0,
        success_rows: 0,
        error_rows: 0,
        file_path: fileName
      })
      .select()
      .single();

    if (jobError || !jobData) {
      console.error('[CSV-IMPORT] Job creation error:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create import job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CSV-IMPORT] Import job created:', jobData.id);

    // Start chunked processing (100 lines per chunk)
    const chunkSize = 100;
    const { error: chunkError } = await supabase.functions.invoke('email-import-chunk', {
      body: {
        job_id: jobData.id,
        user_id: user.id,
        supplier_id: supplierId,
        file_path: fileName,
        offset: 0,
        limit: chunkSize,
        correlation_id: jobId,
        mapping: columnMapping
      }
    });

    if (chunkError) {
      console.error('[CSV-IMPORT] Chunk processing error:', chunkError);
      
      await supabase
        .from('import_jobs')
        .update({ status: 'failed', error_message: chunkError.message })
        .eq('id', jobData.id);

      return new Response(
        JSON.stringify({ error: 'Failed to start chunk processing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update supplier last_sync_at
    await supabase
      .from('supplier_configurations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', supplierId)
      .eq('user_id', user.id);

    // Log the import
    await supabase.from('supplier_import_logs').insert([{
      user_id: user.id,
      supplier_id: supplierId,
      import_type: 'manual',
      source_file: 'csv_upload',
      products_found: validProducts,
      products_matched: 0,
      products_new: 0,
      products_updated: 0,
      products_failed: invalidProducts,
      import_status: 'processing',
    }]);

    console.log('[CSV-IMPORT] Chunked import started successfully');

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobData.id,
        message: 'Import started, processing in chunks',
        stats: {
          total: validProducts,
          invalid: invalidProducts
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CSV-IMPORT] Fatal error:', error);
    return handleError(error, 'SUPPLIER-IMPORT-CSV', corsHeaders);
  }
});
