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
  
  return { files, dirs, method: successMethod };
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Connexion réussie! ${result.files.length} fichiers et ${result.dirs.length} dossiers trouvés`,
        files: result.files,
        dirs: result.dirs,
        method: result.method,
        path: path,
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
