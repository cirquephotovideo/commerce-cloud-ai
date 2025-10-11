import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function testIMAPConnection(config: {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
  folder?: string;
}) {
  console.log(`[IMAP-TEST] Testing connection to ${config.host}:${config.port}...`);
  
  try {
    // Connexion TCP/TLS
    const conn = config.ssl 
      ? await Deno.connectTls({ hostname: config.host, port: config.port })
      : await Deno.connect({ hostname: config.host, port: config.port });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    // Helper pour lire les réponses IMAP
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      const n = await conn.read(buffer);
      if (!n) throw new Error('Connection closed');
      return decoder.decode(buffer.subarray(0, n));
    }
    
    async function sendCommand(tag: string, cmd: string): Promise<string> {
      await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
      let response = '';
      let complete = false;
      
      while (!complete) {
        const chunk = await readResponse();
        response += chunk;
        // IMAP responses end with "TAG OK" or "TAG BAD" or "TAG NO"
        if (response.includes(`${tag} OK`) || response.includes(`${tag} BAD`) || response.includes(`${tag} NO`)) {
          complete = true;
        }
      }
      
      return response;
    }
    
    // 1. Lire le greeting
    const greeting = await readResponse();
    console.log('[IMAP-TEST] Greeting:', greeting.trim());
    
    if (!greeting.includes('OK')) {
      throw new Error('Server did not send OK greeting');
    }
    
    // 2. LOGIN
    const loginResp = await sendCommand('A001', `LOGIN ${config.email} ${config.password}`);
    console.log('[IMAP-TEST] Login response:', loginResp.trim());
    
    if (!loginResp.includes('A001 OK')) {
      throw new Error('Authentication failed');
    }
    
    // 3. LIST folders
    const listResp = await sendCommand('A002', 'LIST "" "*"');
    console.log('[IMAP-TEST] Folders:', listResp.substring(0, 500));
    
    const folders = listResp
      .split('\n')
      .filter(line => line.includes('* LIST'))
      .map(line => {
        const match = line.match(/"([^"]+)"\s*$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    // 4. SELECT folder (test)
    const folderToTest = config.folder || 'INBOX';
    const selectResp = await sendCommand('A003', `SELECT ${folderToTest}`);
    console.log('[IMAP-TEST] Select response:', selectResp.trim());
    
    if (!selectResp.includes('A003 OK')) {
      throw new Error(`Cannot access folder ${folderToTest}`);
    }
    
    // Extract message count
    const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
    const messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;
    
    // 5. LOGOUT
    await sendCommand('A004', 'LOGOUT');
    conn.close();
    
    return {
      success: true,
      message: `✅ Connexion IMAP réussie!`,
      folders: folders,
      messageCount: messageCount,
      selectedFolder: folderToTest
    };
    
  } catch (error) {
    console.error('[IMAP-TEST] Error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port = 993, email, password, ssl = true, folder = 'INBOX' } = await req.json();
    
    if (!host || !email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: host, email, password'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await testIMAPConnection({ host, port, email, password, ssl, folder });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg,
      message: `❌ Erreur de connexion: ${errorMsg}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
