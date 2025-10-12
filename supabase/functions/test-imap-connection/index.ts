import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// MD5 Implementation
function md5(message: Uint8Array): Uint8Array {
  const s = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  const r = new Uint8Array([
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ]);

  const g = new Uint8Array([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,
    1, 6,11, 0, 5,10,15, 4, 9,14, 3, 8,13, 2, 7,12,
    5, 8,11,14, 1, 4, 7,10,13, 0, 3, 6, 9,12,15, 2,
    0, 7,14, 5,12, 3,10, 1, 8,15, 6,13, 4,11, 2, 9
  ]);

  const originalLen = message.length;
  const newLen = originalLen + ((55 - (originalLen % 64)) % 64) + 9;
  const padded = new Uint8Array(newLen);
  padded.set(message);
  padded[originalLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32((newLen - 8), originalLen * 8, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < newLen; offset += 64) {
    const chunk = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      chunk[i] = view.getUint32(offset + i * 4, true);
    }

    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, dtemp;
      if (i < 16) {
        F = (B & C) | (~B & D);
        dtemp = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        dtemp = g[i];
      } else if (i < 48) {
        F = B ^ C ^ D;
        dtemp = g[i];
      } else {
        F = C ^ (B | ~D);
        dtemp = g[i];
      }

      F = (F + A + s[i] + chunk[dtemp]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << r[i]) | (F >>> (32 - r[i])))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, a0, true);
  resultView.setUint32(4, b0, true);
  resultView.setUint32(8, c0, true);
  resultView.setUint32(12, d0, true);

  return result;
}

function hmacMd5(key: string, message: string): string {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const messageBytes = encoder.encode(message);

  const blockSize = 64;
  let processedKey: Uint8Array;

  if (keyBytes.length > blockSize) {
    processedKey = new Uint8Array(blockSize);
    processedKey.set(md5(keyBytes));
  } else if (keyBytes.length < blockSize) {
    processedKey = new Uint8Array(blockSize);
    processedKey.set(keyBytes);
  } else {
    processedKey = keyBytes;
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    ipad[i] = processedKey[i] ^ 0x36;
    opad[i] = processedKey[i] ^ 0x5c;
  }

  const innerHash = md5(new Uint8Array([...ipad, ...messageBytes]));
  const outerHash = md5(new Uint8Array([...opad, ...innerHash]));

  return Array.from(outerHash).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCapabilities(greeting: string): string[] {
  const capMatch = greeting.match(/\* CAPABILITY (.+)/i);
  if (!capMatch) return [];
  return capMatch[1].trim().split(/\s+/);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function testIMAPConnection(config: {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
  folder?: string;
}): Promise<{
  success: boolean;
  message: string;
  authMethod: string;
  folders: string[];
  messageCount: number;
  selectedFolder: string;
}> {
  // ✅ Phase 6.1: Validate hostname before attempting connection
  const hostnameRegex = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/;
  if (!hostnameRegex.test(config.host)) {
    throw new Error(`Invalid hostname format: ${config.host}`);
  }
  
  console.log(`[IMAP-TEST] Validating hostname: ${config.host}`);
  
  // ✅ Try to resolve DNS (optional, may not work in Deno Deploy)
  try {
    const dnsResult = await Deno.resolveDns(config.host, "A");
    console.log(`[IMAP-TEST] DNS resolution successful:`, dnsResult);
  } catch (dnsError) {
    console.warn(`[IMAP-TEST] DNS resolution failed (non-fatal):`, dnsError);
    // Continue anyway as some environments may block DNS resolution
  }

  let conn: Deno.Conn;
  const CONNECTION_TIMEOUT = 10000; // ✅ 10 seconds timeout
  
  try {
    // ✅ Establish connection with timeout (SSL or plain)
    const connectionPromise = config.ssl
      ? Deno.connectTls({
          hostname: config.host,
          port: config.port,
        })
      : Deno.connect({
          hostname: config.host,
          port: config.port,
        });
    
    // ✅ Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), CONNECTION_TIMEOUT);
    });
    
    conn = await Promise.race([connectionPromise, timeoutPromise]);
    console.log('[IMAP-TEST] Connection established successfully');
  } catch (connError) {
    console.error('[IMAP-TEST] Connection failed:', connError);
    const errorMsg = connError instanceof Error ? connError.message : String(connError);
    throw new Error(`Connection failed: ${errorMsg}. Verify hostname and port are correct.`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

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
      if (chunk.includes(`${tag} OK`) || chunk.includes(`${tag} BAD`) || chunk.includes(`${tag} NO`)) {
        complete = true;
      }
    }

    return response;
  }

  try {
    const greeting = await readResponse();
    console.log('[IMAP-TEST] Server greeting:', greeting);

    if (!greeting.includes('OK')) {
      throw new Error('Invalid IMAP greeting');
    }

    const capabilities = parseCapabilities(greeting);
    console.log('[IMAP-TEST] Capabilities:', capabilities);

    let authMethod = 'LOGIN';
    let authenticated = false;

    if (capabilities.includes('AUTH=CRAM-MD5')) {
      try {
        console.log('[IMAP-TEST] Attempting CRAM-MD5 authentication...');
        await conn.write(encoder.encode(`A001 AUTHENTICATE CRAM-MD5\r\n`));
        const challengeResponse = await readResponse();

        const challengeMatch = challengeResponse.match(/\+ (.+)/);
        if (challengeMatch) {
          const challenge = atob(challengeMatch[1].trim());
          const hmac = hmacMd5(config.password, challenge);
          const authString = `${config.email} ${hmac}`;
          const authBase64 = btoa(authString);

          await conn.write(encoder.encode(`${authBase64}\r\n`));
          const authResponse = await readResponse();

          if (authResponse.includes('A001 OK')) {
            authMethod = 'CRAM-MD5';
            authenticated = true;
            console.log('[IMAP-TEST] CRAM-MD5 authentication successful');
          }
        }
      } catch (cramError) {
        console.warn('[IMAP-TEST] CRAM-MD5 authentication failed, falling back to LOGIN:', cramError);
      }
    }

    if (!authenticated) {
      console.log('[IMAP-TEST] Using LOGIN authentication...');
      const loginResponse = await sendCommand(
        'A002',
        `LOGIN "${config.email}" "${config.password}"`
      );

      if (!loginResponse.includes('A002 OK')) {
        throw new Error('Authentication failed');
      }
      authMethod = 'LOGIN';
      console.log('[IMAP-TEST] LOGIN authentication successful');
    }

    const listResponse = await sendCommand('A003', 'LIST "" "*"');
    const folders = listResponse.match(/\* LIST \(.+?\) ".+?" "(.+?)"/g)?.map(
      line => line.match(/"([^"]+)"$/)?.[1] || ''
    ) || [];

    console.log('[IMAP-TEST] Available folders:', folders);

    const selectedFolder = config.folder || 'INBOX';
    const selectResponse = await sendCommand('A004', `SELECT "${selectedFolder}"`);

    if (!selectResponse.includes('A004 OK')) {
      throw new Error(`Failed to select folder: ${selectedFolder}`);
    }

    const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
    const messageCount = existsMatch ? parseInt(existsMatch[1], 10) : 0;

    console.log(`[IMAP-TEST] Selected folder: ${selectedFolder}, Message count: ${messageCount}`);

    await sendCommand('A005', 'LOGOUT');
    conn.close();

    return {
      success: true,
      message: 'IMAP connection test successful',
      authMethod,
      folders,
      messageCount,
      selectedFolder,
    };

  } catch (error: any) {
    conn.close();
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, email, password, ssl, folder } = await req.json();

    console.log(`[IMAP-TEST] Starting test for ${email}@${host}:${port} (SSL: ${ssl})`);

    const result = await testIMAPConnection({
      host,
      port,
      email,
      password,
      ssl,
      folder,
    });

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[IMAP-TEST] Test failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Connection test failed: ${error.message}`,
        authMethod: 'N/A',
        folders: [],
        messageCount: 0,
        selectedFolder: 'N/A',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
