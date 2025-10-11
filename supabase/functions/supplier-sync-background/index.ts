import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to connect to FTP
async function connectFTP(host: string, port: number, username: string, password: string) {
  console.log(`[BG-SYNC] Connecting to ${host}:${port}...`);
  const cleanHost = host.replace(/^(ftp|ftps):\/\//, '');
  const conn = await Deno.connect({ hostname: cleanHost, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    if (!n) throw new Error('Connection closed');
    return decoder.decode(buffer.subarray(0, n));
  }
  
  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }
  
  await readResponse(); // Welcome
  await sendCommand(`USER ${username}`);
  const passResp = await sendCommand(`PASS ${password}`);
  
  if (!passResp.startsWith('230')) {
    throw new Error('FTP authentication failed');
  }
  
  return { conn, sendCommand, readResponse };
}

// Helper to download file from FTP
async function downloadFTPFile(ftpClient: any, remotePath: string): Promise<string> {
  const pasvResp = await ftpClient.sendCommand('PASV');
  const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!pasvMatch) throw new Error('Failed to enter passive mode');
  
  const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
  const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
  const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
  
  await ftpClient.sendCommand(`RETR ${remotePath}`);
  
  const buffer = new Uint8Array(1024 * 1024);
  let content = '';
  try {
    while (true) {
      const n = await dataConn.read(buffer);
      if (!n) break;
      content += new TextDecoder().decode(buffer.subarray(0, n));
    }
  } catch (e) {
    // Connection closed
  }
  dataConn.close();
  
  return content;
}

// Parse CSV with NO LIMITS
function parseCSV(
  content: string, 
  delimiter: string = ';', 
  skipFirstRow: boolean = false,
  columnMapping?: any
): any[] {
  content = content.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  
  // Auto-detect delimiter
  if (lines.length > 0) {
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    if (commaCount > 3 && commaCount > semicolonCount) {
      delimiter = ',';
    }
  }
  
  console.log(`[BG-SYNC] Total lines in CSV: ${lines.length}`);
  const startIndex = skipFirstRow ? 1 : 0;
  
  // NO LIMIT - Process ALL products
  const products = [];
  let skipped = 0;
  
  const extractField = (columns: string[], mapping: any): string | null => {
    if (!mapping) return null;
    if (typeof mapping === 'number') {
      return columns[mapping] || null;
    }
    if (typeof mapping === 'object' && mapping.col !== undefined) {
      const cellValue = columns[mapping.col] || '';
      if (mapping.sub === undefined) {
        return cellValue.trim();
      }
      const subDelimiter = mapping.subDelimiter || ',';
      const subFields = cellValue.split(subDelimiter).map(s => s.trim());
      return subFields[mapping.sub] || null;
    }
    return null;
  };
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (columns.length < 2) {
      skipped++;
      continue;
    }
    
    const productName = extractField(columns, columnMapping?.product_name) || columns[0] || '';
    const supplierRef = extractField(columns, columnMapping?.supplier_reference) || columns[1] || '';
    const ean = extractField(columns, columnMapping?.ean) || (columns[2] || null);
    
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
    
    let stockQuantity: number | null = null;
    const stockStr = extractField(columns, columnMapping?.stock_quantity);
    if (stockStr) {
      const parsed = parseInt(stockStr);
      if (!isNaN(parsed)) {
        stockQuantity = parsed;
      }
    }
    
    if (!supplierRef || !purchasePrice) {
      skipped++;
      continue;
    }
    
    products.push({
      product_name: productName || supplierRef,
      supplier_reference: supplierRef,
      ean: ean || null,
      purchase_price: purchasePrice,
      stock_quantity: stockQuantity,
      currency: 'EUR',
    });
  }
  
  console.log(`[BG-SYNC] ✅ Parsed ${products.length} valid products (skipped ${skipped})`);
  return products;
}

// Background processing function
async function processImport(jobId: string, supplierId: string, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log(`[BG-SYNC] Starting background import for job ${jobId}`);
    
    // Update job to running
    await supabase
      .from('import_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);
    
    // Load supplier config
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();
    
    if (supplierError || !supplier) {
      throw new Error('Supplier not found');
    }
    
    const config = supplier.connection_config as any;
    
    if (!config?.host || !config?.username || !config?.password || !config?.remote_path) {
      throw new Error('Incomplete FTP configuration');
    }
    
    const port = config.port || 21;
    const delimiter = config.csv_delimiter || ';';
    const skipFirstRow = config.skip_first_row || false;
    
    // Connect to FTP and download
    const ftpClient = await connectFTP(config.host, port, config.username, config.password);
    const csvContent = await downloadFTPFile(ftpClient, config.remote_path);
    ftpClient.conn.close();
    
    console.log(`[BG-SYNC] Downloaded ${csvContent.length} bytes`);
    
    // Parse ALL products (no limit)
    const mapping = supplier.column_mapping;
    const allProducts = parseCSV(csvContent, delimiter, skipFirstRow, mapping);
    
    await supabase
      .from('import_jobs')
      .update({ progress_total: allProducts.length })
      .eq('id', jobId);
    
    // Process in batches of 1000
    const BATCH_SIZE = 1000;
    let imported = 0;
    let matched = 0;
    let errors = 0;
    
    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE);
      console.log(`[BG-SYNC] Processing batch ${i / BATCH_SIZE + 1} (${batch.length} products)`);
      
      // Prepare batch data for upsert
      const batchData = batch.map(product => ({
        supplier_id: supplierId,
        user_id: userId,
        product_name: product.product_name,
        supplier_reference: product.supplier_reference,
        ean: product.ean,
        purchase_price: product.purchase_price,
        currency: 'EUR',
        stock_quantity: product.stock_quantity,
      }));
      
      // Upsert batch
      const { data: upserted, error: upsertError } = await supabase
        .from('supplier_products')
        .upsert(batchData, {
          onConflict: 'supplier_id,supplier_reference',
          ignoreDuplicates: false
        });
      
      if (upsertError) {
        console.error('[BG-SYNC] Batch upsert error:', upsertError);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
      
      // Update progress
      await supabase
        .from('import_jobs')
        .update({
          progress_current: Math.min(i + BATCH_SIZE, allProducts.length),
          products_imported: imported,
          products_matched: matched,
          products_errors: errors
        })
        .eq('id', jobId);
    }
    
    // Mark as completed
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_current: allProducts.length,
        products_imported: imported,
        products_matched: matched,
        products_errors: errors
      })
      .eq('id', jobId);
    
    // Update supplier last_synced_at
    await supabase
      .from('supplier_configurations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', supplierId);
    
    console.log(`[BG-SYNC] ✅ Completed: ${allProducts.length} products, ${imported} imported, ${errors} errors`);
    
  } catch (error) {
    console.error('[BG-SYNC] Error:', error);
    
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { supplierId } = await req.json();

    // Create import job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        supplier_id: supplierId,
        user_id: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Start background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(processImport(job.id, supplierId, user.id));
    } else {
      // Fallback for local development
      processImport(job.id, supplierId, user.id);
    }

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: job.id,
        message: "Import démarré en arrière-plan"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[BG-SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
