import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function testPOP3Connection(config: {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
}) {
  console.log(`[POP3-TEST] Testing connection to ${config.host}:${config.port}...`);
  
  try {
    // Connexion TCP/TLS
    const conn = config.ssl 
      ? await Deno.connectTls({ hostname: config.host, port: config.port })
      : await Deno.connect({ hostname: config.host, port: config.port });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    // Helper pour lire les réponses POP3
    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(4096);
      const n = await conn.read(buffer);
      if (!n) throw new Error('Connection closed');
      return decoder.decode(buffer.subarray(0, n));
    }
    
    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(`${cmd}\r\n`));
      return await readResponse();
    }
    
    // 1. Lire le greeting
    const greeting = await readResponse();
    console.log('[POP3-TEST] Greeting:', greeting.trim());
    
    if (!greeting.startsWith('+OK')) {
      throw new Error('Server did not send +OK greeting');
    }
    
    // 2. USER
    const userResp = await sendCommand(`USER ${config.email}`);
    console.log('[POP3-TEST] USER response:', userResp.trim());
    
    if (!userResp.startsWith('+OK')) {
      throw new Error('USER command failed');
    }
    
    // 3. PASS
    const passResp = await sendCommand(`PASS ${config.password}`);
    console.log('[POP3-TEST] PASS response:', passResp.trim());
    
    if (!passResp.startsWith('+OK')) {
      throw new Error('Authentication failed');
    }
    
    // 4. STAT (get message count)
    const statResp = await sendCommand('STAT');
    console.log('[POP3-TEST] STAT response:', statResp.trim());
    
    const statMatch = statResp.match(/\+OK (\d+) (\d+)/);
    const messageCount = statMatch ? parseInt(statMatch[1]) : 0;
    const totalBytes = statMatch ? parseInt(statMatch[2]) : 0;
    
    // 5. QUIT
    await sendCommand('QUIT');
    conn.close();
    
    return {
      success: true,
      message: `✅ Connexion POP3 réussie!`,
      messageCount: messageCount,
      totalBytes: totalBytes
    };
    
  } catch (error) {
    console.error('[POP3-TEST] Error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port = 995, email, password, ssl = true } = await req.json();
    
    if (!host || !email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: host, email, password'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const result = await testPOP3Connection({ host, port, email, password, ssl });
    
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
