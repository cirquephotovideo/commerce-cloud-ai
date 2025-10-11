import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function testFTPConnection(host: string, port: number, username: string, password: string, path: string = '/') {
  console.log(`[FTP-TEST] Connecting to ${host}:${port} path="${path}"...`);
  
  const cleanHost = host.replace(/^(ftp|ftps):\/\//, '');
  
  const conn = await Deno.connect({ hostname: cleanHost, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(4096);
    const n = await conn.read(buffer);
    if (!n) throw new Error('Connection closed');
    return decoder.decode(buffer.subarray(0, n));
  }
  
  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }
  
  // Read welcome
  const welcome = await readResponse();
  console.log('[FTP-TEST] Server:', welcome.trim());
  
  // Login
  await sendCommand(`USER ${username}`);
  const passResp = await sendCommand(`PASS ${password}`);
  
  if (!passResp.startsWith('230')) {
    conn.close();
    throw new Error('Authentication failed');
  }
  
  // Change directory if specified
  if (path && path !== '/') {
    const cwdResp = await sendCommand(`CWD ${path}`);
    console.log(`[FTP-TEST] CWD ${path}:`, cwdResp.trim());
    if (!cwdResp.startsWith('250')) {
      console.log(`[FTP-TEST] Warning: CWD failed, staying in root`);
    }
  }
  
  // Try different LIST methods including MLSD
  const listMethods = ['MLSD', 'LIST', 'LIST .', 'NLST', 'NLST .'];
  let fileList = '';
  let successMethod = '';
  let dirs: string[] = [];
  let files: string[] = [];
  
  for (const method of listMethods) {
    try {
      console.log(`[FTP-TEST] Trying ${method}...`);
      
      // Enter passive mode
      const pasvResp = await sendCommand('PASV');
      const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
      if (!pasvMatch) {
        console.log(`[FTP-TEST] ${method}: PASV failed`);
        continue;
      }
      
      const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
      const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
      
      // Connect to data port
      const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
      
      // Send LIST/NLST/MLSD command
      const listResp = await sendCommand(method);
      console.log(`[FTP-TEST] ${method} response:`, listResp.trim());
      
      // Read file listing with larger buffer
      const buffer = new Uint8Array(65536); // 64KB buffer
      let tempList = '';
      try {
        while (true) {
          const n = await dataConn.read(buffer);
          if (!n) break;
          tempList += decoder.decode(buffer.subarray(0, n));
        }
      } catch (e) {
        // Expected EOF
      }
      
      dataConn.close();
      
      // Wait for transfer complete
      try {
        await readResponse();
      } catch (e) {
        // Ignore timeout
      }
      
      console.log(`[FTP-TEST] ${method} raw response (${tempList.length} bytes):`);
      console.log(tempList.substring(0, 800));
      
      if (tempList.trim()) {
        fileList = tempList;
        successMethod = method;
        
        // Parse based on method
        if (method === 'MLSD') {
          // MLSD format: type=file;size=123;modify=...; filename
          const lines = fileList.split(/\r?\n/).filter(l => l.trim());
          lines.forEach(line => {
            // Extract type and filename
            const typeMatch = line.match(/type=([^;]+)/);
            const type = typeMatch ? typeMatch[1].toLowerCase() : '';
            
            // Skip current/parent directory entries
            if (type === 'cdir' || type === 'pdir') return;
            
            // Extract filename (after last semicolon + space)
            const parts = line.split(/;\s*/);
            const filename = parts[parts.length - 1].trim();
            
            if (filename && filename !== '.' && filename !== '..') {
              if (type === 'dir') {
                dirs.push(filename);
              } else if (type === 'file') {
                files.push(filename);
              }
            }
          });
        } else {
          // LIST/NLST format
          const lines = fileList.split(/\r?\n/).filter(l => l.trim());
          lines.forEach(line => {
            const isDir = line.startsWith('d');
            const parts = line.split(/\s+/);
            const name = parts[parts.length - 1];
            if (name && name !== '.' && name !== '..') {
              if (isDir) dirs.push(name);
              else files.push(name);
            }
          });
        }
        
        break;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.log(`[FTP-TEST] ${method} failed:`, errorMsg);
    }
  }
  
  conn.close();
  
  if (!fileList.trim()) {
    throw new Error(`No files found in ${path} with any LIST method. Try a different directory.`);
  }
  
  console.log(`[FTP-TEST] ✅ Success with ${successMethod}`);
  console.log(`[FTP-TEST] Found ${dirs.length} directories:`, dirs);
  console.log(`[FTP-TEST] Found ${files.length} files:`, files);
  
  return { files, dirs, method: successMethod, conn };
}

async function downloadCSVFile(conn: Deno.Conn, filename: string): Promise<any[]> {
  console.log(`[FTP-TEST] Downloading file: ${filename}...`);
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(4096);
    const n = await conn.read(buffer);
    if (!n) throw new Error('Connection closed');
    return decoder.decode(buffer.subarray(0, n));
  }
  
  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }
  
  // Enter passive mode
  const pasvResp = await sendCommand('PASV');
  const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!pasvMatch) {
    throw new Error('PASV command failed');
  }
  
  const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
  const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
  
  // Connect to data port
  const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
  
  // Send RETR command
  const retrResp = await sendCommand(`RETR ${filename}`);
  console.log(`[FTP-TEST] RETR response:`, retrResp.trim());
  
  if (!retrResp.startsWith('150')) {
    dataConn.close();
    throw new Error(`Failed to retrieve file: ${retrResp}`);
  }
  
  // Download file content
  const buffer = new Uint8Array(1048576); // 1MB buffer
  let csvContent = '';
  try {
    while (true) {
      const n = await dataConn.read(buffer);
      if (!n) break;
      csvContent += decoder.decode(buffer.subarray(0, n));
      
      // Limit to first 100KB to avoid memory issues
      if (csvContent.length > 102400) break;
    }
  } catch (e) {
    // Expected EOF
  }
  
  dataConn.close();
  
  // Wait for transfer complete
  try {
    await readResponse();
  } catch (e) {
    // Ignore timeout
  }
  
  console.log(`[FTP-TEST] Downloaded ${csvContent.length} bytes`);
  
  // Parse CSV (simple parser)
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  const previewLines = lines.slice(0, 11); // Header + 10 rows
  
  const preview = previewLines.map(line => {
    // Simple CSV parsing (handles quoted fields with commas)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    
    return fields;
  });
  
  console.log(`[FTP-TEST] Parsed ${preview.length} preview rows`);
  
  return preview;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port = 21, username, password, path = '/' } = await req.json();

    if (!host || !username || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: host, username, password' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await testFTPConnection(host, port, username, password, path);
    
    // If path points to a CSV file, download and parse it
    let preview = null;
    if (path && path.toLowerCase().endsWith('.csv')) {
      try {
        const filename = path.split('/').pop() || path;
        preview = await downloadCSVFile(result.conn, filename);
        console.log(`[FTP-TEST] Created preview with ${preview.length} rows`);
      } catch (error) {
        console.error('[FTP-TEST] Error downloading CSV:', error);
        // Continue without preview
      }
    }
    
    result.conn.close();

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Connexion réussie! ${result.files.length} fichiers et ${result.dirs.length} dossiers trouvés`,
        files: result.files,
        dirs: result.dirs,
        method: result.method,
        path: path,
        preview: preview,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[FTP-TEST] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        message: `❌ Échec de connexion: ${error instanceof Error ? error.message : 'Unknown error'}`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
