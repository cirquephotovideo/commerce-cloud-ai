import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Implémentation MD5 simple pour HMAC
function md5(message: Uint8Array): Uint8Array {
  // Implémentation MD5 de base pour Deno
  const hexDigits = "0123456789abcdef";
  
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }
  
  function addUnsigned(x: number, y: number): number {
    return ((x & 0xFFFFFFFF) + (y & 0xFFFFFFFF)) & 0xFFFFFFFF;
  }
  
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = addUnsigned(addUnsigned(a, q), addUnsigned(x, t));
    return addUnsigned(rotateLeft(a, s), b);
  }
  
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  
  const msgLen = message.length;
  const numBlocks = ((msgLen + 8) >>> 6) + 1;
  const totalLen = numBlocks * 16;
  const words = new Array(totalLen);
  
  for (let i = 0; i < msgLen; i++) {
    words[i >>> 2] |= message[i] << ((i % 4) * 8);
  }
  
  words[msgLen >>> 2] |= 0x80 << ((msgLen % 4) * 8);
  words[totalLen - 2] = msgLen * 8;
  
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;
  
  for (let i = 0; i < totalLen; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;
    
    a = ff(a, b, c, d, words[i + 0], 7, 0xD76AA478);
    d = ff(d, a, b, c, words[i + 1], 12, 0xE8C7B756);
    c = ff(c, d, a, b, words[i + 2], 17, 0x242070DB);
    b = ff(b, c, d, a, words[i + 3], 22, 0xC1BDCEEE);
    a = ff(a, b, c, d, words[i + 4], 7, 0xF57C0FAF);
    d = ff(d, a, b, c, words[i + 5], 12, 0x4787C62A);
    c = ff(c, d, a, b, words[i + 6], 17, 0xA8304613);
    b = ff(b, c, d, a, words[i + 7], 22, 0xFD469501);
    a = ff(a, b, c, d, words[i + 8], 7, 0x698098D8);
    d = ff(d, a, b, c, words[i + 9], 12, 0x8B44F7AF);
    c = ff(c, d, a, b, words[i + 10], 17, 0xFFFF5BB1);
    b = ff(b, c, d, a, words[i + 11], 22, 0x895CD7BE);
    a = ff(a, b, c, d, words[i + 12], 7, 0x6B901122);
    d = ff(d, a, b, c, words[i + 13], 12, 0xFD987193);
    c = ff(c, d, a, b, words[i + 14], 17, 0xA679438E);
    b = ff(b, c, d, a, words[i + 15], 22, 0x49B40821);
    
    a = gg(a, b, c, d, words[i + 1], 5, 0xF61E2562);
    d = gg(d, a, b, c, words[i + 6], 9, 0xC040B340);
    c = gg(c, d, a, b, words[i + 11], 14, 0x265E5A51);
    b = gg(b, c, d, a, words[i + 0], 20, 0xE9B6C7AA);
    a = gg(a, b, c, d, words[i + 5], 5, 0xD62F105D);
    d = gg(d, a, b, c, words[i + 10], 9, 0x02441453);
    c = gg(c, d, a, b, words[i + 15], 14, 0xD8A1E681);
    b = gg(b, c, d, a, words[i + 4], 20, 0xE7D3FBC8);
    a = gg(a, b, c, d, words[i + 9], 5, 0x21E1CDE6);
    d = gg(d, a, b, c, words[i + 14], 9, 0xC33707D6);
    c = gg(c, d, a, b, words[i + 3], 14, 0xF4D50D87);
    b = gg(b, c, d, a, words[i + 8], 20, 0x455A14ED);
    a = gg(a, b, c, d, words[i + 13], 5, 0xA9E3E905);
    d = gg(d, a, b, c, words[i + 2], 9, 0xFCEFA3F8);
    c = gg(c, d, a, b, words[i + 7], 14, 0x676F02D9);
    b = gg(b, c, d, a, words[i + 12], 20, 0x8D2A4C8A);
    
    a = hh(a, b, c, d, words[i + 5], 4, 0xFFFA3942);
    d = hh(d, a, b, c, words[i + 8], 11, 0x8771F681);
    c = hh(c, d, a, b, words[i + 11], 16, 0x6D9D6122);
    b = hh(b, c, d, a, words[i + 14], 23, 0xFDE5380C);
    a = hh(a, b, c, d, words[i + 1], 4, 0xA4BEEA44);
    d = hh(d, a, b, c, words[i + 4], 11, 0x4BDECFA9);
    c = hh(c, d, a, b, words[i + 7], 16, 0xF6BB4B60);
    b = hh(b, c, d, a, words[i + 10], 23, 0xBEBFBC70);
    a = hh(a, b, c, d, words[i + 13], 4, 0x289B7EC6);
    d = hh(d, a, b, c, words[i + 0], 11, 0xEAA127FA);
    c = hh(c, d, a, b, words[i + 3], 16, 0xD4EF3085);
    b = hh(b, c, d, a, words[i + 6], 23, 0x04881D05);
    a = hh(a, b, c, d, words[i + 9], 4, 0xD9D4D039);
    d = hh(d, a, b, c, words[i + 12], 11, 0xE6DB99E5);
    c = hh(c, d, a, b, words[i + 15], 16, 0x1FA27CF8);
    b = hh(b, c, d, a, words[i + 2], 23, 0xC4AC5665);
    
    a = ii(a, b, c, d, words[i + 0], 6, 0xF4292244);
    d = ii(d, a, b, c, words[i + 7], 10, 0x432AFF97);
    c = ii(c, d, a, b, words[i + 14], 15, 0xAB9423A7);
    b = ii(b, c, d, a, words[i + 5], 21, 0xFC93A039);
    a = ii(a, b, c, d, words[i + 12], 6, 0x655B59C3);
    d = ii(d, a, b, c, words[i + 3], 10, 0x8F0CCC92);
    c = ii(c, d, a, b, words[i + 10], 15, 0xFFEFF47D);
    b = ii(b, c, d, a, words[i + 1], 21, 0x85845DD1);
    a = ii(a, b, c, d, words[i + 8], 6, 0x6FA87E4F);
    d = ii(d, a, b, c, words[i + 15], 10, 0xFE2CE6E0);
    c = ii(c, d, a, b, words[i + 6], 15, 0xA3014314);
    b = ii(b, c, d, a, words[i + 13], 21, 0x4E0811A1);
    a = ii(a, b, c, d, words[i + 4], 6, 0xF7537E82);
    d = ii(d, a, b, c, words[i + 11], 10, 0xBD3AF235);
    c = ii(c, d, a, b, words[i + 2], 15, 0x2AD7D2BB);
    b = ii(b, c, d, a, words[i + 9], 21, 0xEB86D391);
    
    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }
  
  const result = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    result[i] = (a >>> (i * 8)) & 0xFF;
    result[i + 4] = (b >>> (i * 8)) & 0xFF;
    result[i + 8] = (c >>> (i * 8)) & 0xFF;
    result[i + 12] = (d >>> (i * 8)) & 0xFF;
  }
  
  return result;
}

// Parser les capabilities IMAP du greeting
function parseCapabilities(greeting: string): string[] {
  const capMatch = greeting.match(/CAPABILITY ([^\]]+)\]/i);
  if (!capMatch) return [];
  return capMatch[1].split(' ').map(c => c.trim());
}

// Implémenter HMAC-MD5
function hmacMd5(key: string, message: string): string {
  const blockSize = 64;
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  
  // Si clé trop longue, la hasher
  let finalKey: Uint8Array = keyBytes;
  if (keyBytes.length > blockSize) {
    finalKey = new Uint8Array(md5(keyBytes));
  }
  
  // Padding de la clé
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(finalKey);
  
  // HMAC = H(K XOR opad, H(K XOR ipad, message))
  const ipad = paddedKey.map(b => b ^ 0x36);
  const opad = paddedKey.map(b => b ^ 0x5c);
  
  const ipadMessage = new Uint8Array(ipad.length + encoder.encode(message).length);
  ipadMessage.set(ipad);
  ipadMessage.set(encoder.encode(message), ipad.length);
  const innerHash = md5(ipadMessage);
  
  const opadHash = new Uint8Array(opad.length + innerHash.length);
  opadHash.set(opad);
  opadHash.set(innerHash, opad.length);
  const outerHash = md5(opadHash);
  
  return Array.from(outerHash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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
    
    // 2. Parser les capabilities
    const capabilities = parseCapabilities(greeting);
    console.log('[IMAP-TEST] Capabilities detected:', capabilities.join(', '));
    
    const hasLoginDisabled = capabilities.includes('LOGINDISABLED');
    const hasCramMd5 = capabilities.some(c => c === 'AUTH=CRAM-MD5');
    const hasDigestMd5 = capabilities.some(c => c === 'AUTH=DIGEST-MD5');
    
    console.log('[IMAP-TEST] Auth methods available:', {
      loginDisabled: hasLoginDisabled,
      cramMd5: hasCramMd5,
      digestMd5: hasDigestMd5
    });
    
    // 3. Choisir la méthode d'authentification
    let authSuccess = false;
    let authMethod = '';
    
    if (hasLoginDisabled && hasCramMd5) {
      // Utiliser CRAM-MD5
      console.log('[IMAP-TEST] Using CRAM-MD5 authentication...');
      authMethod = 'CRAM-MD5';
      
      try {
        await conn.write(encoder.encode('A001 AUTHENTICATE CRAM-MD5\r\n'));
        
        // Lire le challenge
        const challengeResp = await readResponse();
        console.log('[IMAP-TEST] Challenge received:', challengeResp.trim());
        
        if (!challengeResp.startsWith('+')) {
          throw new Error('Expected challenge from server');
        }
        
        // Extraire et décoder le challenge
        const challengeB64 = challengeResp.substring(2).trim();
        const challenge = atob(challengeB64);
        console.log('[IMAP-TEST] Decoded challenge:', challenge);
        
        // Calculer HMAC-MD5
        const hmac = hmacMd5(config.password, challenge);
        const response = `${config.email} ${hmac}`;
        console.log('[IMAP-TEST] HMAC computed, sending response...');
        
        // Envoyer la réponse encodée
        const responseB64 = btoa(response);
        await conn.write(encoder.encode(`${responseB64}\r\n`));
        
        // Lire la réponse d'authentification
        const authResp = await readResponse();
        console.log('[IMAP-TEST] Auth response:', authResp.trim());
        
        if (authResp.includes('A001 OK')) {
          authSuccess = true;
          console.log('[IMAP-TEST] ✅ CRAM-MD5 authentication successful!');
        } else {
          throw new Error(`CRAM-MD5 failed: ${authResp.trim()}`);
        }
      } catch (cramError) {
        console.error('[IMAP-TEST] CRAM-MD5 error:', cramError);
        throw new Error(`CRAM-MD5 authentication failed: ${cramError instanceof Error ? cramError.message : String(cramError)}`);
      }
    } else if (!hasLoginDisabled) {
      // Utiliser LOGIN classique
      console.log('[IMAP-TEST] Using standard LOGIN authentication...');
      authMethod = 'LOGIN';
      const loginResp = await sendCommand('A001', `LOGIN ${config.email} ${config.password}`);
      console.log('[IMAP-TEST] Login response:', loginResp.trim());
      
      if (loginResp.includes('A001 OK')) {
        authSuccess = true;
        console.log('[IMAP-TEST] ✅ LOGIN authentication successful!');
      } else {
        throw new Error(`LOGIN failed: ${loginResp.trim()}`);
      }
    } else {
      throw new Error('No supported authentication method available. Server requires CRAM-MD5 or DIGEST-MD5.');
    }
    
    if (!authSuccess) {
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
      message: `✅ Connexion IMAP réussie avec ${authMethod}!`,
      authMethod: authMethod,
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
