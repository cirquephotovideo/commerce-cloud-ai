import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple FTP client implementation using TCP sockets
async function connectFTP(host: string, port: number, username: string, password: string) {
  console.log(`[FTP] Connecting to ${host}:${port}...`);
  
  // Remove protocol if present
  const cleanHost = host.replace(/^(ftp|ftps):\/\//, '');
  
  const conn = await Deno.connect({ hostname: cleanHost, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Helper to read FTP response
  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    if (!n) throw new Error('Connection closed');
    return decoder.decode(buffer.subarray(0, n));
  }
  
  // Helper to send FTP command
  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }
  
  // Read welcome message
  const welcome = await readResponse();
  console.log('[FTP] Server:', welcome.trim());
  
  // Login
  const userResp = await sendCommand(`USER ${username}`);
  console.log('[FTP] USER response:', userResp.trim());
  
  const passResp = await sendCommand(`PASS ${password}`);
  console.log('[FTP] PASS response:', passResp.trim());
  
  if (!passResp.startsWith('230')) {
    throw new Error('FTP authentication failed');
  }
  
  console.log('[FTP] ✅ Connected and authenticated');
  
  return { conn, sendCommand, readResponse };
}

async function listFTPFiles(ftpClient: any, path: string = '/'): Promise<string[]> {
  console.log(`[FTP] Listing files in ${path}...`);
  
  // Enter passive mode
  const pasvResp = await ftpClient.sendCommand('PASV');
  const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!pasvMatch) throw new Error('Failed to enter passive mode');
  
  const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
  const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
  
  // Connect to data port
  const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
  
  // Send LIST command
  await ftpClient.sendCommand(`LIST ${path}`);
  
  // Read file listing
  const buffer = new Uint8Array(8192);
  let fileList = '';
  try {
    while (true) {
      const n = await dataConn.read(buffer);
      if (!n) break;
      fileList += new TextDecoder().decode(buffer.subarray(0, n));
    }
  } catch (e) {
    // Connection closed, which is expected
  }
  dataConn.close();
  
  // Parse file names
  const files = fileList.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s+/);
      return parts[parts.length - 1];
    })
    .filter(f => f && !f.startsWith('.'));
  
  console.log(`[FTP] Found ${files.length} files:`, files);
  return files;
}

async function downloadFTPFile(ftpClient: any, remotePath: string): Promise<string> {
  console.log(`[FTP] Downloading ${remotePath}...`);
  
  // Enter passive mode
  const pasvResp = await ftpClient.sendCommand('PASV');
  const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!pasvMatch) throw new Error('Failed to enter passive mode');
  
  const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
  const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
  
  // Connect to data port
  const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
  
  // Send RETR command
  await ftpClient.sendCommand(`RETR ${remotePath}`);
  
  // Read file content
  const buffer = new Uint8Array(1024 * 1024); // 1MB buffer
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
  
  console.log(`[FTP] ✅ Downloaded ${content.length} bytes`);
  return content;
}

function parseCSV(
  content: string, 
  delimiter: string = ';', 
  skipFirstRow: boolean = false,
  columnMapping?: any
): any[] {
  const lines = content.split('\n').filter(l => l.trim());
  
  console.log(`[FTP-SYNC] Total lines in CSV: ${lines.length}`);
  console.log('[FTP-SYNC] CSV delimiter:', delimiter);
  console.log('[FTP-SYNC] Skip first row:', skipFirstRow);
  console.log('[FTP-SYNC] Column mapping:', JSON.stringify(columnMapping));
  
  if (lines.length === 0) return [];
  
  // Log first 3 lines to see structure
  console.log('[FTP-SYNC] First 3 lines:');
  lines.slice(0, 3).forEach((line, i) => {
    console.log(`  Line ${i}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
  });
  
  const startIndex = skipFirstRow ? 1 : 0;
  const products = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    
    if (columns.length < 2) continue; // Need at least name and reference
    
    // Use column_mapping if available, otherwise use default indices
    const product: any = {
      name: columnMapping?.product_name !== undefined 
        ? columns[columnMapping.product_name] 
        : columns[0],
      supplier_reference: columnMapping?.supplier_reference !== undefined
        ? columns[columnMapping.supplier_reference]
        : columns[1],
      ean: columnMapping?.ean !== undefined
        ? columns[columnMapping.ean] || null
        : columns[2] || null,
      purchase_price: null,
      stock_quantity: null,
    };
    
    // Parse price
    const priceIndex = columnMapping?.purchase_price !== undefined 
      ? columnMapping.purchase_price 
      : 3;
    if (columns[priceIndex]) {
      const priceStr = columns[priceIndex].replace(/,/g, '.');
      product.purchase_price = parseFloat(priceStr) || null;
    }
    
    // Parse stock
    const stockIndex = columnMapping?.stock_quantity !== undefined 
      ? columnMapping.stock_quantity 
      : 4;
    if (columns[stockIndex]) {
      product.stock_quantity = parseInt(columns[stockIndex]) || null;
    }
    
    products.push(product);
  }
  
  console.log(`[FTP-SYNC] Parsed ${products.length} products`);
  if (products.length > 0) {
    console.log('[FTP-SYNC] First product sample:', JSON.stringify(products[0]));
  }
  
  return products;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { supplierId } = await req.json();

    console.log('[FTP-SYNC] Starting for supplier:', supplierId);

    // Load supplier configuration
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error('Supplier not found');
    }

    const config = supplier.connection_config as any;
    
    if (!config?.host || !config?.username || !config?.password) {
      console.log('[FTP-SYNC] Incomplete FTP config');
      return new Response(
        JSON.stringify({
          success: false,
          message: '⚠️ Configuration FTP incomplète (host/username/password manquant)',
          warning: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!config?.remote_path) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '⚠️ Chemin du fichier CSV non configuré (remote_path)',
          warning: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const port = config.port || 21;
    const delimiter = config.csv_delimiter || ';';
    const skipFirstRow = config.skip_first_row || false;

    // Connect to FTP
    let ftpClient;
    try {
      ftpClient = await connectFTP(config.host, port, config.username, config.password);
    } catch (error) {
      console.error('[FTP-SYNC] Connection failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: `❌ Échec de connexion FTP: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Download CSV file
    let csvContent: string;
    try {
      csvContent = await downloadFTPFile(ftpClient, config.remote_path);
      console.log('[FTP-SYNC] File size:', csvContent.length, 'bytes');
      ftpClient.conn.close();
    } catch (error) {
      ftpClient.conn.close();
      console.error('[FTP-SYNC] Download failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: `❌ Échec téléchargement fichier: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse CSV with column mapping
    const products = parseCSV(
      csvContent, 
      delimiter, 
      skipFirstRow,
      supplier.column_mapping
    );
    console.log(`[FTP-SYNC] Parsed ${products.length} products from CSV`);

    if (products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          found: 0,
          imported: 0,
          matched: 0,
          message: '⚠️ Aucun produit trouvé dans le fichier CSV',
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Import into supplier_products
    let imported = 0;
    let matched = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Check if product exists
        const { data: existing } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('supplier_reference', product.supplier_reference)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('supplier_products')
            .update({
              name: product.name,
              ean: product.ean,
              purchase_price: product.purchase_price,
              stock_quantity: product.stock_quantity,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('[FTP-SYNC] Update error:', updateError);
            errors++;
          } else {
            matched++;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('supplier_products')
            .insert({
              supplier_id: supplierId,
              user_id: supplier.user_id,
              name: product.name,
              supplier_reference: product.supplier_reference,
              ean: product.ean,
              purchase_price: product.purchase_price,
              currency: 'EUR',
              stock_quantity: product.stock_quantity,
              last_synced_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('[FTP-SYNC] Insert error:', insertError);
            errors++;
          } else {
            imported++;
          }
        }
      } catch (error) {
        console.error('[FTP-SYNC] Product processing error:', error);
        errors++;
      }
    }

    console.log(`[FTP-SYNC] ✅ Complete: ${products.length} found, ${imported} imported, ${matched} matched, ${errors} errors`);

    // Update supplier last_synced_at
    await supabase
      .from('supplier_configurations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', supplierId);

    return new Response(
      JSON.stringify({
        success: true,
        found: products.length,
        imported,
        matched,
        errors,
        message: errors > 0 
          ? `⚠️ Synchronisation avec erreurs: ${imported} importés, ${matched} mis à jour, ${errors} erreurs`
          : `✅ Synchronisation réussie: ${imported} importés, ${matched} mis à jour`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[FTP-SYNC] Fatal error:', error);
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
