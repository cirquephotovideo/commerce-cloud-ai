import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function testFTPConnection(host: string, port: number, username: string, password: string) {
  console.log(`[FTP-TEST] Connecting to ${host}:${port}...`);
  
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
  
  // Enter passive mode
  const pasvResp = await sendCommand('PASV');
  const pasvMatch = pasvResp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!pasvMatch) {
    conn.close();
    throw new Error('Failed to enter passive mode');
  }
  
  const dataPort = parseInt(pasvMatch[5]) * 256 + parseInt(pasvMatch[6]);
  const dataHost = `${pasvMatch[1]}.${pasvMatch[2]}.${pasvMatch[3]}.${pasvMatch[4]}`;
  
  // Connect to data port
  const dataConn = await Deno.connect({ hostname: dataHost, port: dataPort });
  
  // Send LIST command
  await sendCommand('LIST /');
  
  // Read file listing
  const buffer = new Uint8Array(8192);
  let fileList = '';
  try {
    while (true) {
      const n = await dataConn.read(buffer);
      if (!n) break;
      fileList += decoder.decode(buffer.subarray(0, n));
    }
  } catch (e) {
    // Expected EOF
  }
  
  dataConn.close();
  conn.close();
  
  // Parse files
  const files = fileList.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(/\s+/);
      return parts[parts.length - 1];
    })
    .filter(f => f && !f.startsWith('.'));
  
  console.log(`[FTP-TEST] ✅ Found ${files.length} files`);
  return files;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port = 21, username, password } = await req.json();

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

    const files = await testFTPConnection(host, port, username, password);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Connexion réussie! ${files.length} fichiers trouvés`,
        files: files,
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
