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

// Helper to convert MD5 result to hex string
function md5Hex(data: string): string {
  const encoder = new TextEncoder();
  const bytes = md5(encoder.encode(data));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// DIGEST-MD5 authentication
async function authenticateDigestMd5(
  conn: Deno.Conn,
  encoder: TextEncoder,
  decoder: TextDecoder,
  username: string,
  password: string,
  host: string
): Promise<{ success: boolean; response: string; details: any }> {
  
  console.log(`[DIGEST-MD5] Starting authentication with username: ${username}`);
  
  await conn.write(encoder.encode('A001 AUTHENTICATE DIGEST-MD5\r\n'));
  
  // Read challenge
  const buffer = new Uint8Array(4096);
  const n = await conn.read(buffer);
  if (!n) throw new Error('Connection closed');
  const challengeResponse = decoder.decode(buffer.subarray(0, n));
  
  const challengeMatch = challengeResponse.match(/\+ (.+)/);
  if (!challengeMatch) {
    return { success: false, response: challengeResponse, details: { error: 'No challenge received' } };
  }
  
  const challengeB64 = challengeMatch[1].trim();
  const challengeStr = atob(challengeB64);
  console.log(`[DIGEST-MD5] Challenge decoded: ${challengeStr.substring(0, 100)}...`);
  
  // Parse challenge into key-value pairs
  const challengeParams: Record<string, string> = {};
  const paramRegex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
  let match;
  while ((match = paramRegex.exec(challengeStr)) !== null) {
    challengeParams[match[1]] = match[2] || match[3];
  }
  
  const realm = challengeParams.realm || host;
  const nonce = challengeParams.nonce;
  const qop = challengeParams.qop || 'auth';
  const charset = challengeParams.charset || 'utf-8';
  const algorithm = challengeParams.algorithm || 'md5';
  
  if (!nonce) {
    return { success: false, response: challengeResponse, details: { error: 'No nonce in challenge' } };
  }
  
  console.log(`[DIGEST-MD5] Parsed: realm=${realm}, nonce=${nonce.substring(0, 20)}..., qop=${qop}`);
  
  // Generate cnonce (random 16-byte hex)
  const cnonceBytes = new Uint8Array(16);
  crypto.getRandomValues(cnonceBytes);
  const cnonce = Array.from(cnonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const nc = '00000001';
  const digestUri = `imap/${host}`;
  
  // Calculate HA1 and HA2
  let HA1 = md5Hex(`${username}:${realm}:${password}`);
  if (algorithm === 'md5-sess') {
    HA1 = md5Hex(HA1 + `:${nonce}:${cnonce}`);
  }
  
  const HA2 = md5Hex(`AUTHENTICATE:${digestUri}`);
  const response = md5Hex(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`);
  
  console.log(`[DIGEST-MD5] Calculated response: ${response.substring(0, 20)}...`);
  
  // Build response string
  const responseParts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `cnonce="${cnonce}"`,
    `nc=${nc}`,
    `qop=${qop}`,
    `digest-uri="${digestUri}"`,
    `response=${response}`,
  ];
  
  if (charset) {
    responseParts.push(`charset=${charset}`);
  }
  
  const responseStr = responseParts.join(',');
  const responseB64 = btoa(responseStr);
  
  await conn.write(encoder.encode(`${responseB64}\r\n`));
  
  // Read auth response
  const n2 = await conn.read(buffer);
  if (!n2) throw new Error('Connection closed');
  const authResponse = decoder.decode(buffer.subarray(0, n2));
  
  console.log(`[DIGEST-MD5] Server response: ${authResponse.substring(0, 100)}...`);
  
  // Server may send rspauth verification
  if (authResponse.includes('+ ')) {
    console.log(`[DIGEST-MD5] Sending final confirmation`);
    await conn.write(encoder.encode('\r\n'));
    const n3 = await conn.read(buffer);
    if (!n3) throw new Error('Connection closed');
    const finalResponse = decoder.decode(buffer.subarray(0, n3));
    
    return {
      success: finalResponse.includes('A001 OK'),
      response: finalResponse,
      details: {
        realm,
        nonce: nonce.substring(0, 20) + '...',
        cnonce: cnonce.substring(0, 20) + '...',
        response_preview: response.substring(0, 20) + '...'
      }
    };
  }
  
  return {
    success: authResponse.includes('A001 OK'),
    response: authResponse,
    details: {
      realm,
      nonce: nonce.substring(0, 20) + '...',
      cnonce: cnonce.substring(0, 20) + '...',
      response_preview: response.substring(0, 20) + '...'
    }
  };
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
  username?: string;
  password: string;
  ssl: boolean;
  folder?: string;
}): Promise<{
  success: boolean;
  message: string;
  authMethod: string;
  username: string;
  folders: string[];
  messageCount: number;
  selectedFolder: string;
  capabilities: string[];
  auth_attempts: any[];
}> {
  // Validate hostname before attempting connection
  const hostnameRegex = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/;
  if (!hostnameRegex.test(config.host)) {
    throw new Error(`Invalid hostname format: ${config.host}`);
  }
  
  console.log(`[IMAP-TEST] Validating hostname: ${config.host}`);
  
  // Try to resolve DNS (optional, may not work in Deno Deploy)
  try {
    const dnsResult = await Deno.resolveDns(config.host, "A");
    console.log(`[IMAP-TEST] DNS resolution successful:`, dnsResult);
  } catch (dnsError) {
    console.warn(`[IMAP-TEST] DNS resolution failed (non-fatal):`, dnsError);
    // Continue anyway as some environments may block DNS resolution
  }

  let conn: Deno.Conn;
  const CONNECTION_TIMEOUT = 10000; // 10 seconds timeout
  
  try {
    // Establish connection with timeout (SSL or plain)
    const connectionPromise = config.ssl
      ? Deno.connectTls({
          hostname: config.host,
          port: config.port,
        })
      : Deno.connect({
          hostname: config.host,
          port: config.port,
        });
    
    // Add timeout
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

    // Get capabilities
    const capResp = await sendCommand('A000', 'CAPABILITY');
    const allCapabilities = parseCapabilities(greeting + ' ' + capResp);
    console.log('[IMAP-TEST] Server capabilities:', allCapabilities);

    let authMethod = 'LOGIN';
    let authenticated = false;
    let usedUsername = '';
    let authAttempts: any[] = [];
    
    const cramAvailable = allCapabilities.includes('AUTH=CRAM-MD5');
    const digestAvailable = allCapabilities.includes('AUTH=DIGEST-MD5');
    const loginDisabled = allCapabilities.includes('LOGINDISABLED');

    // Build username variants
    const authVariants = [
      config.username || null,        // Explicit username if provided
      config.email,                    // Full email
      config.email.split('@')[0]       // Local part before @
    ].filter(Boolean) as string[];
    
    console.log(`[IMAP-TEST] Auth methods: CRAM=${cramAvailable}, DIGEST=${digestAvailable}, LOGIN=${!loginDisabled}`);
    console.log(`[IMAP-TEST] Testing ${authVariants.length} username variants`);

    // Try CRAM-MD5 first if available
    if (cramAvailable) {
      console.log(`[IMAP-TEST] Attempting CRAM-MD5 with ${authVariants.length} username variants`);
      
      for (const variant of authVariants) {
        try {
          await conn.write(encoder.encode(`A001 AUTHENTICATE CRAM-MD5\r\n`));
          const challengeResponse = await readResponse();

          const challengeMatch = challengeResponse.match(/\+ (.+)/);
          if (challengeMatch) {
            const challenge = atob(challengeMatch[1].trim());
            const hmac = hmacMd5(config.password, challenge);
            const authString = `${variant} ${hmac}`;
            const authBase64 = btoa(authString);

            await conn.write(encoder.encode(`${authBase64}\r\n`));
            const authResponse = await readResponse();
            
            authAttempts.push({
              method: 'CRAM-MD5',
              username: variant,
              challenge,
              hmac_preview: hmac.substring(0, 20),
              response: authResponse.substring(0, 100)
            });

            if (authResponse.includes('A001 OK')) {
              authMethod = 'CRAM-MD5';
              authenticated = true;
              usedUsername = variant;
              console.log(`[IMAP-TEST] ✅ CRAM-MD5 successful with username: ${variant}`);
              break;
            } else {
              console.warn(`[IMAP-TEST] CRAM-MD5 failed with username: ${variant}`);
            }
          }
        } catch (cramError) {
          console.warn(`[IMAP-TEST] CRAM-MD5 error with ${variant}:`, cramError);
          authAttempts.push({
            method: 'CRAM-MD5',
            username: variant,
            error: cramError instanceof Error ? cramError.message : String(cramError)
          });
        }
      }
    }
    
    // Try DIGEST-MD5 if CRAM-MD5 failed and DIGEST is available
    if (!authenticated && digestAvailable) {
      console.log(`[IMAP-TEST] Attempting DIGEST-MD5 with ${authVariants.length} username variants`);
      
      for (const variant of authVariants) {
        try {
          console.log(`[IMAP-TEST] Testing DIGEST-MD5 with: ${variant}`);
          const digestResult = await authenticateDigestMd5(
            conn,
            encoder,
            decoder,
            variant,
            config.password,
            config.host
          );
          
          authAttempts.push({
            method: 'DIGEST-MD5',
            username: variant,
            ...digestResult.details,
            response: digestResult.response.substring(0, 100)
          });
          
          if (digestResult.success) {
            authMethod = 'DIGEST-MD5';
            authenticated = true;
            usedUsername = variant;
            console.log(`[IMAP-TEST] ✅ DIGEST-MD5 successful with username: ${variant}`);
            break;
          } else {
            console.warn(`[IMAP-TEST] DIGEST-MD5 failed with username: ${variant}`);
          }
        } catch (digestError) {
          console.warn(`[IMAP-TEST] DIGEST-MD5 error with ${variant}:`, digestError);
          authAttempts.push({
            method: 'DIGEST-MD5',
            username: variant,
            error: digestError instanceof Error ? digestError.message : String(digestError)
          });
        }
      }
    }

    // Fallback to LOGIN only if not authenticated and LOGIN is not disabled
    if (!authenticated) {
      if (loginDisabled) {
        const supportedMethods = allCapabilities.filter(c => c.startsWith('AUTH=')).join(', ');
        throw new Error(`LOGIN authentication is disabled. Server supports: ${supportedMethods}. All auth methods failed (attempts: ${authAttempts.length}).`);
      }
      
      console.log('[IMAP-TEST] Using LOGIN authentication...');
      const loginResponse = await sendCommand(
        'A002',
        `LOGIN "${config.email}" "${config.password}"`
      );

      if (!loginResponse.includes('A002 OK')) {
        if (loginResponse.includes('535') || loginResponse.includes('authentication failed')) {
          throw new Error('Authentication failed: Invalid username or password');
        }
        throw new Error(`Authentication failed: ${loginResponse}`);
      }
      authMethod = 'LOGIN';
      usedUsername = config.email;
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
      username: usedUsername,
      folders,
      messageCount,
      selectedFolder,
      capabilities: allCapabilities,
      auth_attempts: authAttempts
    };

  } catch (error: any) {
    conn.close();
    throw error;
  }
}

// Sanitize hostname function
function sanitizeHostname(hostname: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let clean = hostname.trim();
  
  // Remove protocol prefixes
  const protocolPrefixes = ['imap://', 'imaps://', 'http://', 'https://'];
  for (const prefix of protocolPrefixes) {
    if (clean.toLowerCase().startsWith(prefix)) {
      clean = clean.substring(prefix.length);
      warnings.push(`Préfixe "${prefix}" retiré automatiquement`);
    }
  }
  
  // Remove trailing slashes
  clean = clean.replace(/\/+$/, '');
  
  // Check for spaces
  if (clean.includes(' ')) {
    warnings.push('Votre hostname contient des espaces, vérifiez le copier/coller');
  }
  
  return { sanitized: clean, warnings };
}

// Enhanced error hints
function getAuthErrorHints(errorMessage: string, host: string): string[] {
  const hints: string[] = [];
  const lowerHost = host.toLowerCase();
  
  if (lowerHost.includes('gmail') || lowerHost.includes('google')) {
    hints.push('Gmail: Activez IMAP dans Paramètres > Voir tous les paramètres > Transfert et POP/IMAP');
    hints.push('Gmail: Créez un "App Password" sur https://myaccount.google.com/apppasswords');
    hints.push('Gmail: N\'utilisez PAS votre mot de passe habituel');
  } else if (lowerHost.includes('outlook') || lowerHost.includes('office365') || lowerHost.includes('live')) {
    hints.push('Outlook: Créez un App Password sur https://account.microsoft.com/security');
    hints.push('Outlook: Activez IMAP dans les paramètres de votre compte');
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    hints.push('Vérifiez que le port et le hostname sont corrects');
    hints.push('Vérifiez votre pare-feu / proxy');
  }
  
  return hints;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[IMAP-TEST] Starting connection test...');

  try {
    let { host, port = 993, email, username, password, ssl = true, folder = 'INBOX' } = await req.json();

    // Phase 1: Sanitize and validate
    const { sanitized, warnings } = sanitizeHostname(host);
    host = sanitized;

    // Basic validation
    if (!host || !email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Paramètres manquants (host, email, password requis)',
        hints: ['Vérifiez que tous les champs sont remplis']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Validate hostname format
    if (host.includes('/') || host.includes('\\')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Format de hostname invalide (ne doit pas contenir de slashes)',
        hints: ['Exemple correct: imap.gmail.com', 'Exemple incorrect: imaps://imap.gmail.com/']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`[IMAP-TEST] Testing connection to ${host}:${port} (SSL: ${ssl})`);
    if (warnings.length > 0) {
      console.log(`[IMAP-TEST] Warnings during sanitization:`, warnings);
    }

    try {
      const result = await testIMAPConnection({ host, port, email, username, password, ssl, folder });
      
      const response: any = {
        ...result
      };
      
      // Add sanitization warnings if any
      if (warnings.length > 0) {
        response.warnings = warnings;
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (testError: any) {
      console.error('[IMAP-TEST] Test failed:', testError);
      
      // Enhanced error handling
      let errorMessage = testError.message || 'Erreur de connexion';
      const hints = getAuthErrorHints(errorMessage, host);
      
      // Detect specific auth errors
      if (errorMessage.includes('535') || errorMessage.includes('NO LOGIN failed')) {
        errorMessage = 'Authentification refusée - vérifiez vos identifiants';
        hints.unshift('Pour Gmail/Outlook: utilisez un App Password, pas votre mot de passe principal');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Timeout de connexion - vérifiez host/port/pare-feu';
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        hints,
        message: errorMessage,
        authMethod: 'N/A',
        username: '',
        folders: [],
        messageCount: 0,
        selectedFolder: 'N/A'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
  } catch (error: any) {
    console.error('[IMAP-TEST] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erreur interne'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});