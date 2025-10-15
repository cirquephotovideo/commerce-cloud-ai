// IMAP Email Poller - Version 2.2.0 (DIGEST-MD5 Support Added)
// Last updated: 2025-10-15 16:30:00 UTC
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log('[IMAP-POLLER] Starting Version 2.2.0 with CRAM-MD5 and DIGEST-MD5 support');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MD5 Implementation (native Deno, no crypto.subtle.importKey needed)
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

// HMAC-MD5 for CRAM-MD5 authentication
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
  sendCommand: (cmd: string) => Promise<void>,
  readResponse: () => Promise<string>,
  username: string,
  password: string,
  host: string
): Promise<{ success: boolean; response: string; details: any }> {
  
  console.log(`[DIGEST-MD5] Starting authentication with username: ${username}`);
  
  await sendCommand('a002 AUTHENTICATE DIGEST-MD5');
  const challengeResponse = await readResponse();
  
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
  
  await sendCommand(responseB64);
  const authResponse = await readResponse();
  
  console.log(`[DIGEST-MD5] Server response: ${authResponse.substring(0, 100)}...`);
  
  // Server may send rspauth verification
  if (authResponse.includes('+ ')) {
    console.log(`[DIGEST-MD5] Sending final confirmation`);
    await sendCommand('');
    const finalResponse = await readResponse();
    
    return {
      success: finalResponse.includes('a002 OK'),
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
    success: authResponse.includes('a002 OK'),
    response: authResponse,
    details: {
      realm,
      nonce: nonce.substring(0, 20) + '...',
      cnonce: cnonce.substring(0, 20) + '...',
      response_preview: response.substring(0, 20) + '...'
    }
  };
}

// Utility to connect to IMAP
async function connectIMAP(host: string, port: number, useTLS: boolean) {
  const conn = useTLS 
    ? await Deno.connectTls({ hostname: host, port })
    : await Deno.connect({ hostname: host, port });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function sendCommand(command: string): Promise<void> {
    console.log(`[IMAP] → ${command.substring(0, 100)}...`);
    await conn.write(encoder.encode(command + '\r\n'));
  }

  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(16384);
    const n = await conn.read(buffer);
    if (!n) return '';
    const response = decoder.decode(buffer.subarray(0, n));
    console.log(`[IMAP] ← ${response.substring(0, 500)}...`);
    return response;
  }

  return { conn, sendCommand, readResponse, encoder, decoder };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplierId, sinceDays } = await req.json();

    if (!supplierId) {
      return new Response(
        JSON.stringify({ success: false, error: 'supplierId required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const daysToSearch = sinceDays || 3; // Default to 3 days

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch supplier
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supplier not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const config = supplier.connection_config || {};
    const userId = supplier.user_id;
    const supplierName = supplier.supplier_name;
    
    const imapHost = config.imap_host;
    const imapPort = config.imap_port || 993;
    const imapSsl = config.imap_ssl !== false;
    const imapEmail = config.imap_email;
    const imapUsername = config.imap_username; // Optional: explicit username for CRAM-MD5
    const imapFolder = config.imap_folder || 'INBOX';
    let imapPassword = config.imap_password;

    console.log(`[${supplierId}] Starting poll for ${supplierName}`);

    // 🔥 LOG SYSTÉMATIQUE AU DÉMARRAGE
    await supabaseAdmin.from('email_poll_logs').insert({
      user_id: userId,
      supplier_id: supplierId,
      status: 'started',
      emails_found: 0,
      emails_processed: 0,
      details: {
        sinceDays: daysToSearch,
        supplier_name: supplierName,
        imap_host: imapHost,
        imap_folder: imapFolder,
        started_at: new Date().toISOString()
      }
    });

    // Detect and decrypt password if encrypted
    const isEncrypted = imapPassword && imapPassword.length > 50 && /^[A-Za-z0-9+/=]+$/.test(imapPassword);
    
    if (isEncrypted) {
      console.log(`[${supplierId}] Decrypting password...`);
      const { data: decrypted, error: decryptError } = await supabaseAdmin.rpc(
        'decrypt_email_password',
        { encrypted_password: imapPassword }
      );
      
      if (decryptError || !decrypted) {
        throw new Error(`Password decryption failed: ${decryptError?.message}`);
      }
      
      imapPassword = decrypted;
    }

    if (!imapHost || !imapEmail || !imapPassword) {
      throw new Error('Incomplete IMAP configuration');
    }

    // Connect to IMAP
    const { conn, sendCommand, readResponse } = await connectIMAP(imapHost, imapPort, imapSsl);

    try {
      // Read greeting
      let greeting = await readResponse();
      if (!greeting.includes('OK')) {
        throw new Error('IMAP greeting did not contain OK');
      }

      // Get capabilities
      await sendCommand('a001 CAPABILITY');
      const capabilityResponse = await readResponse();

      // Authentication with CRAM-MD5 and DIGEST-MD5 support
      let authResponse = '';
      let usedUsername = '';
      let authMethod = '';
      let authAttempts: any[] = [];
      const loginDisabled = capabilityResponse.includes('LOGINDISABLED');
      const cramAvailable = capabilityResponse.includes('AUTH=CRAM-MD5');
      const digestAvailable = capabilityResponse.includes('AUTH=DIGEST-MD5');
      
      // Build username variants
      const authVariants = [
        imapUsername || null,          // Explicit username if provided
        imapEmail,                     // Full email
        imapEmail.split('@')[0]        // Local part before @
      ].filter(Boolean) as string[];
      
      console.log(`[${supplierId}] Auth methods available: CRAM=${cramAvailable}, DIGEST=${digestAvailable}, LOGIN=${!loginDisabled}`);
      console.log(`[${supplierId}] Username variants to test:`, authVariants);
      
      // Try CRAM-MD5 first if available
      if (cramAvailable) {
        console.log(`[${supplierId}] Attempting CRAM-MD5 with ${authVariants.length} username variants`);
        
        for (const variant of authVariants) {
          try {
            console.log(`[${supplierId}] Testing CRAM-MD5 with: ${variant}`);
            await sendCommand('a002 AUTHENTICATE CRAM-MD5');
            const challengeResponse = await readResponse();
            
            const challengeMatch = challengeResponse.match(/\+ (.+)/);
            if (challengeMatch) {
              const challengeB64 = challengeMatch[1].trim();
              const challenge = atob(challengeB64);
              console.log(`[${supplierId}] Challenge received (decoded): ${challenge}`);
              
              const hmacHex = hmacMd5(imapPassword, challenge);
              console.log(`[${supplierId}] HMAC-MD5 calculated: ${hmacHex.substring(0, 20)}...`);
              
              const authString = `${variant} ${hmacHex}`;
              const response = btoa(authString);
              
              await sendCommand(response);
              authResponse = await readResponse();
              
              authAttempts.push({
                method: 'CRAM-MD5',
                username: variant,
                challenge: challenge,
                hmac_preview: hmacHex.substring(0, 20),
                response: authResponse.substring(0, 100)
              });
              
              if (authResponse.includes('a002 OK')) {
                usedUsername = variant;
                authMethod = 'CRAM-MD5';
                console.log(`[${supplierId}] ✅ CRAM-MD5 succeeded with username: ${variant}`);
                break;
              } else {
                console.log(`[${supplierId}] ❌ CRAM-MD5 failed with username: ${variant}`);
              }
            }
          } catch (cramError) {
            console.warn(`[${supplierId}] CRAM-MD5 error with ${variant}:`, cramError);
            authAttempts.push({
              method: 'CRAM-MD5',
              username: variant,
              error: cramError instanceof Error ? cramError.message : String(cramError)
            });
          }
        }
      }
      
      // Try DIGEST-MD5 if CRAM-MD5 failed and DIGEST is available
      if (!authResponse.includes('OK') && digestAvailable) {
        console.log(`[${supplierId}] Attempting DIGEST-MD5 with ${authVariants.length} username variants`);
        
        for (const variant of authVariants) {
          try {
            console.log(`[${supplierId}] Testing DIGEST-MD5 with: ${variant}`);
            const digestResult = await authenticateDigestMd5(
              sendCommand,
              readResponse,
              variant,
              imapPassword,
              imapHost
            );
            
            authAttempts.push({
              method: 'DIGEST-MD5',
              username: variant,
              ...digestResult.details,
              response: digestResult.response.substring(0, 100)
            });
            
            if (digestResult.success) {
              authResponse = digestResult.response;
              usedUsername = variant;
              authMethod = 'DIGEST-MD5';
              console.log(`[${supplierId}] ✅ DIGEST-MD5 succeeded with username: ${variant}`);
              break;
            } else {
              console.log(`[${supplierId}] ❌ DIGEST-MD5 failed with username: ${variant}`);
            }
          } catch (digestError) {
            console.warn(`[${supplierId}] DIGEST-MD5 error with ${variant}:`, digestError);
            authAttempts.push({
              method: 'DIGEST-MD5',
              username: variant,
              error: digestError instanceof Error ? digestError.message : String(digestError)
            });
          }
        }
      }
      
      // If all methods failed and LOGIN is disabled, log and throw
      if (!authResponse.includes('OK') && loginDisabled) {
        console.log(`[${supplierId}] All auth methods failed and LOGIN is disabled`);
        
        await supabaseAdmin.from('email_poll_logs').insert({
          user_id: userId,
          supplier_id: supplierId,
          status: 'auth_failed',
          emails_found: 0,
          emails_processed: 0,
          details: { 
            capabilities: capabilityResponse,
            auth_attempts: authAttempts,
            error: `Authentication failed with all methods (CRAM-MD5: ${cramAvailable}, DIGEST-MD5: ${digestAvailable}). LOGIN is disabled by server.`
          }
        });
        
        throw new Error('Authentication failed: All methods exhausted and LOGIN is disabled');
      }

      // Fallback to LOGIN ONLY if all other methods failed AND LOGIN is not disabled
      if (!authResponse.includes('OK') && !loginDisabled) {
        console.log(`[${supplierId}] Attempting LOGIN authentication`);
        await sendCommand(`a003 LOGIN ${imapEmail} ${imapPassword}`);
        authResponse = await readResponse();
        
        if (!authResponse.includes('a003 OK')) {
          // Log detailed auth failure
          await supabaseAdmin.from('email_poll_logs').insert({
            user_id: userId,
            supplier_id: supplierId,
            status: 'auth_failed',
            emails_found: 0,
            emails_processed: 0,
            details: { 
              capabilities: capabilityResponse,
              auth_attempts: authAttempts,
              attempted_user: imapEmail,
              server_response: authResponse,
              error: 'Authentication failed with all methods'
            }
          });
          
          throw new Error('Authentication failed with all methods');
        }
        usedUsername = imapEmail;
      } else if (!authResponse.includes('OK')) {
        // Neither CRAM-MD5 nor LOGIN succeeded
        throw new Error('Authentication failed: All methods exhausted');
      }

      console.log(`[${supplierId}] ✅ Authentication successful via ${authMethod || 'LOGIN'} (user: ${usedUsername})`);

      // Select mailbox
      await sendCommand(`a004 SELECT "${imapFolder}"`);
      const selectResponse = await readResponse();
      
      if (!selectResponse.includes('OK')) {
        throw new Error(`Failed to select folder: ${imapFolder}`);
      }

      // Search for recent messages - sinceDays parameter allows extending the window
      const searchDateObj = new Date();
      searchDateObj.setDate(searchDateObj.getDate() - daysToSearch);
      const searchDate = searchDateObj.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }).replace(/ /g, '-');
      
      console.log(`[${supplierId}] Searching emails since ${searchDate} (${daysToSearch} days)`);
      
      await sendCommand(`a005 SEARCH SINCE ${searchDate}`);
      const searchResponse = await readResponse();
      
      const searchMatch = searchResponse.match(/\* SEARCH (.+)/);
      if (!searchMatch || !searchMatch[1].trim()) {
        console.log(`[${supplierId}] No emails found since ${searchDate}`);
        
        await supabaseAdmin.from('email_poll_logs').insert({
          user_id: userId,
          supplier_id: supplierId,
          status: 'no_new_emails',
          emails_found: 0,
          emails_processed: 0,
          details: { message: `No emails since ${searchDate}` }
        });
        
        conn.close();
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            supplier: supplierName,
            emails: 0,
            message: `No emails found since ${searchDate}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let messageIds = searchMatch[1].trim().split(' ').map(id => id.trim()).filter(id => id);
      
      // Limit to latest 25 emails
      if (messageIds.length > 25) {
        console.log(`[${supplierId}] Limiting to latest 25 emails (found ${messageIds.length})`);
        messageIds = messageIds.slice(-25);
      }
      
      console.log(`[${supplierId}] Found ${messageIds.length} emails to process`);

      let processedCount = 0;
      const processedEmails = [];

      for (const msgId of messageIds) {
        try {
          // Fetch headers and BODYSTRUCTURE
          await sendCommand(`a${100 + parseInt(msgId)} FETCH ${msgId} (BODY[HEADER.FIELDS (FROM SUBJECT)] BODYSTRUCTURE)`);
          let fullResponse = '';
          let chunk = await readResponse();
          fullResponse += chunk;
          
          while (!chunk.includes(`a${100 + parseInt(msgId)} OK`)) {
            chunk = await readResponse();
            fullResponse += chunk;
          }
          
          const fromMatch = fullResponse.match(/From: (.+)/i);
          const subjectMatch = fullResponse.match(/Subject: (.+)/i);
          
          const fromEmail = fromMatch ? fromMatch[1].trim() : imapEmail;
          const subject = subjectMatch ? subjectMatch[1].trim() : 'Import IMAP automatique';

          const bodyStructMatch = fullResponse.match(/BODYSTRUCTURE \((.+)\)/s);
          if (!bodyStructMatch) {
            console.log(`[${supplierId}] Email ${msgId}: No BODYSTRUCTURE found`);
            continue;
          }

          const bodyStruct = bodyStructMatch[1];
          
          // Look for CSV/XLSX/XLS/ZIP attachments with improved patterns
          // CRITICAL FIX: Match IMAP BODYSTRUCTURE format with parentheses
          
          // Pattern 1: Content-Type with IMAP parentheses format
          // Matches: ("application" "x-msexcel" ("name" "Tarifs FVS.xls") ...)
          const contentTypePattern = /\("(application|text)"\s+"(x-msexcel|vnd\.ms-excel|msexcel|vnd\.openxmlformats[^"]+|zip|csv|octet-stream)"[^)]*\("(filename|name)"\s+"?([^")\s]+)"?\)/gi;
          
          // Pattern 2: Extension-based (most reliable)
          // Matches: ("filename" "document.xlsx") or ("name" "file.xls")
          const extensionPattern = /\("(filename|name)"\s+"?([^")\s]+\.(csv|xlsx?|xls|zip))"?\)/gi;
          
          // Pattern 3: Attachment keyword with parentheses
          // Matches: ("attachment" ... ("filename" "data.csv") ...)
          const attachmentPattern = /\("attachment"[^)]*\("(filename|name)"\s+"?([^")\s]+\.(csv|xlsx?|xls|zip))"?\)/gi;
          
          // Pattern 4: Simple fallback - any filename with valid extension
          const simpleExtPattern = /([A-Za-z0-9_\-\s]+\.(?:xlsx?|xls|csv|zip))/gi;
          
          const attachmentSet = new Set<string>();
          const detectionDetails: any[] = [];
          let match;
          
          // Test Pattern 1 (content-type with parentheses)
          contentTypePattern.lastIndex = 0;
          while ((match = contentTypePattern.exec(bodyStruct)) !== null) {
            const filename = match[4];
            const ext = filename.split('.').pop()?.toLowerCase();
            if (['csv', 'xlsx', 'xls', 'zip'].includes(ext || '')) {
              const key = JSON.stringify({ filename, type: ext });
              if (!attachmentSet.has(key)) {
                attachmentSet.add(key);
                detectionDetails.push({ filename, type: ext, detected_by: 'content-type' });
              }
            }
          }
          
          // Test Pattern 2 (extension-based)
          extensionPattern.lastIndex = 0;
          while ((match = extensionPattern.exec(bodyStruct)) !== null) {
            const filename = match[2];
            const ext = match[3].toLowerCase();
            const key = JSON.stringify({ filename, type: ext });
            if (!attachmentSet.has(key)) {
              attachmentSet.add(key);
              detectionDetails.push({ filename, type: ext, detected_by: 'extension' });
            }
          }
          
          // Test Pattern 3 (attachment keyword)
          attachmentPattern.lastIndex = 0;
          while ((match = attachmentPattern.exec(bodyStruct)) !== null) {
            const filename = match[2];
            const ext = match[3].toLowerCase();
            const key = JSON.stringify({ filename, type: ext });
            if (!attachmentSet.has(key)) {
              attachmentSet.add(key);
              detectionDetails.push({ filename, type: ext, detected_by: 'attachment-keyword' });
            }
          }
          
          // Test Pattern 4 (simple extension fallback)
          simpleExtPattern.lastIndex = 0;
          while ((match = simpleExtPattern.exec(bodyStruct)) !== null) {
            const filename = match[1];
            const ext = filename.split('.').pop()?.toLowerCase();
            if (['csv', 'xlsx', 'xls', 'zip'].includes(ext || '')) {
              const key = JSON.stringify({ filename, type: ext });
              if (!attachmentSet.has(key)) {
                attachmentSet.add(key);
                detectionDetails.push({ filename, type: ext, detected_by: 'simple-ext' });
              }
            }
          }
          
          const attachments = Array.from(attachmentSet).map(str => JSON.parse(str));
          
          // Enhanced logging for debugging
          console.log(`[${supplierId}] Detection results:`, {
            total_attachments: attachments.length,
            details: detectionDetails
          });
          
          // Prepare email base data for insertion
          const emailBaseData = {
            user_id: userId,
            supplier_id: supplierId,
            from_email: fromEmail,
            from_name: fromEmail.match(/^(.+?)\s*</)?.[1] || fromEmail.split('@')[0],
            subject: subject,
            received_at: new Date().toISOString(),
            detection_method: 'email',
            detected_supplier_name: supplierName,
            detection_confidence: 100,
            processing_logs: [{
              timestamp: new Date().toISOString(),
              message: `Email received from ${fromEmail}`,
              subject: subject
            }]
          };

          if (attachments.length === 0) {
            console.log(`[${supplierId}] ⚠️ Email ${msgId}: NO ATTACHMENTS DETECTED`);
            console.log(`[${supplierId}] BODYSTRUCTURE (first 800 chars):`, bodyStruct.substring(0, 800));
            
            // Manual pattern testing for debugging
            console.log(`[${supplierId}] Pattern testing:`, {
              contentType: contentTypePattern.test(bodyStruct),
              extension: extensionPattern.test(bodyStruct),
              attachment: attachmentPattern.test(bodyStruct),
              simpleExt: simpleExtPattern.test(bodyStruct)
            });
            
            // Insert email with status "ignored"
            await supabaseAdmin.from('email_inbox').insert({
              ...emailBaseData,
              status: 'ignored',
              error_message: 'No CSV/XLSX/XLS/ZIP attachment found',
              processing_logs: [
                ...emailBaseData.processing_logs,
                { 
                  timestamp: new Date().toISOString(), 
                  message: 'No processable attachment - marked as ignored',
                  bodystructure_sample: bodyStruct.substring(0, 500)
                }
              ]
            });
            
            console.log(`[${supplierId}] Email ${msgId} stored as "ignored" (no valid attachment)`);
            continue;
          }

          console.log(`[${supplierId}] Email ${msgId}: Found ${attachments.length} attachment(s):`);
          detectionDetails.forEach(d => {
            console.log(`  ✓ ${d.filename} (${d.type.toUpperCase()}) detected by: ${d.detected_by}`);
          });

          // 🔥 EXTRACTION ROBUSTE avec fallback BLIND + détection par magic bytes
          let contentMatch: RegExpMatchArray | null = null;
          let successfulPart: string | null = null;
          let detectedType: string | null = null;
          let detectedFilename: string | null = null;
          
          // Try extended parts list for blind extraction
          const partsToTry = ['1.2', '2', '1.3', '2.1', '3', '4', '5'];
          
          for (const partNumber of partsToTry) {
            console.log(`[${supplierId}] Email ${msgId}: Trying BODY[${partNumber}]...`);
            
            await sendCommand(`a${200 + parseInt(msgId)} FETCH ${msgId} BODY[${partNumber}]`);
            let bodyContent = '';
            chunk = await readResponse();
            bodyContent += chunk;
            
            while (!chunk.includes(`a${200 + parseInt(msgId)} OK`)) {
              chunk = await readResponse();
              bodyContent += chunk;
            }

            contentMatch = bodyContent.match(/BODY\[[\d.]+\]\s+(?:\{[\d]+\}\r?\n)?([A-Za-z0-9+/=\s]+)/is);
            
            if (contentMatch && contentMatch[1].length > 100) {
              successfulPart = partNumber;
              console.log(`[${supplierId}] Email ${msgId}: ✅ Found valid content in BODY[${partNumber}]`);
              
              // 🔥 DÉTECTION PAR MAGIC BYTES
              const base64Sample = contentMatch[1].replace(/[\r\n\s]/g, '');
              try {
                const sampleBytes = Uint8Array.from(atob(base64Sample.substring(0, 200)), c => c.charCodeAt(0));
                
                // ZIP/XLSX (PK\x03\x04)
                if (sampleBytes[0] === 0x50 && sampleBytes[1] === 0x4B && sampleBytes[2] === 0x03 && sampleBytes[3] === 0x04) {
                  detectedType = 'xlsx'; // Most likely XLSX (ZIP-based)
                  console.log(`[${supplierId}] 🧬 Magic bytes: XLSX/ZIP detected`);
                }
                // XLS (D0 CF 11 E0 - OLE)
                else if (sampleBytes[0] === 0xD0 && sampleBytes[1] === 0xCF && sampleBytes[2] === 0x11 && sampleBytes[3] === 0xE0) {
                  detectedType = 'xls';
                  console.log(`[${supplierId}] 🧬 Magic bytes: XLS (OLE) detected`);
                }
                // CSV (text with , or ;)
                else {
                  const textSample = new TextDecoder().decode(sampleBytes.slice(0, 100));
                  if (textSample.includes(',') || textSample.includes(';')) {
                    detectedType = 'csv';
                    console.log(`[${supplierId}] 🧬 Magic bytes: CSV detected`);
                  }
                }
                
                // Generate filename if not detected
                if (!detectedFilename && detectedType) {
                  const timestamp = new Date().getTime();
                  detectedFilename = `${supplierName.replace(/\s+/g, '_')}-${timestamp}.${detectedType}`;
                  console.log(`[${supplierId}] Generated filename: ${detectedFilename}`);
                }
              } catch (magicError) {
                console.warn(`[${supplierId}] Magic bytes detection failed:`, magicError);
              }
              
              break;
            }
          }
          
          if (!contentMatch || !successfulPart) {
            console.log(`[${supplierId}] Email ${msgId}: ❌ Could not extract attachment - SAVING RAW .eml`);
            
            // 🔥 FALLBACK: Sauvegarder l'email complet (.eml) pour debug
            try {
              await sendCommand(`a${900 + parseInt(msgId)} FETCH ${msgId} BODY[]`);
              let rawEmail = '';
              chunk = await readResponse();
              rawEmail += chunk;
              
              while (!chunk.includes(`a${900 + parseInt(msgId)} OK`)) {
                chunk = await readResponse();
                rawEmail += chunk;
              }
              
              const rawMatch = rawEmail.match(/BODY\[\]\s+(?:\{[\d]+\}\r?\n)?([\s\S]+?)(?=\r?\na\d+ OK)/);
              if (rawMatch && rawMatch[1]) {
                const emlContent = new TextEncoder().encode(rawMatch[1]);
                const emlPath = `raw/${userId}/${supplierId}/${msgId}-${new Date().getTime()}.eml`;
                
                const { data: emlUpload, error: emlError } = await supabaseAdmin
                  .storage
                  .from('email-attachments')
                  .upload(emlPath, emlContent, {
                    contentType: 'message/rfc822',
                    upsert: false
                  });
                
                if (!emlError && emlUpload) {
                  console.log(`[${supplierId}] ✅ Saved raw .eml: ${emlUpload.path}`);
                  
                  // Insert as "ignored" with .eml link
                  await supabaseAdmin.from('email_inbox').insert({
                    ...emailBaseData,
                    attachment_name: attachments[0]?.filename || 'unknown',
                    attachment_url: emlUpload.path,
                    status: 'ignored',
                    error_message: 'No exploitable attachment - raw .eml saved for debug',
                    processing_logs: [
                      ...emailBaseData.processing_logs,
                      {
                        timestamp: new Date().toISOString(),
                        message: 'Raw .eml saved',
                        raw_eml_url: emlUpload.path,
                        bodystructure_sample: bodyStruct.substring(0, 500)
                      }
                    ]
                  });
                }
              }
            } catch (emlError) {
              console.error(`[${supplierId}] Failed to save .eml:`, emlError);
            }
            
            continue;
          }

          const base64Content = contentMatch[1].replace(/[\r\n\s]/g, '');
          const attachmentBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

          // 🔥 Use detected filename/type if BODYSTRUCTURE failed
          const fileName = attachments[0]?.filename || detectedFilename || `${supplierName}-${new Date().getTime()}.bin`;
          const fileType = attachments[0]?.type || detectedType || 'bin';

          console.log(`[${supplierId}] Email ${msgId}: Decoded ${fileName}, size: ${attachmentBuffer.length} bytes`);

          // Upload to Storage
          const timestamp = new Date().getTime();
          const storagePath = `${userId}/${supplierId}/${timestamp}-${fileName}`;
          
          const contentTypeMap: Record<string, string> = {
            'csv': 'text/csv',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'zip': 'application/zip'
          };

          const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('email-attachments')
            .upload(storagePath, attachmentBuffer, {
              contentType: contentTypeMap[fileType] || 'application/octet-stream',
              upsert: false
            });

          if (uploadError) {
            console.error(`[${supplierId}] Upload error for email ${msgId}:`, uploadError);
            continue;
          }

          console.log(`[${supplierId}] Uploaded to Storage:`, uploadData.path);

          // Insert into email_inbox with detailed logs
          const detectedBy = detectionDetails.find(d => d.filename === fileName)?.detected_by || 'unknown';
          
          const { data: inboxData, error: inboxError } = await supabaseAdmin
            .from('email_inbox')
            .insert({
              ...emailBaseData,
              attachment_name: fileName,
              attachment_type: fileType,
              attachment_url: uploadData.path,
              attachment_size_kb: Math.round(attachmentBuffer.length / 1024),
              status: 'pending',
              processing_logs: [
                ...emailBaseData.processing_logs,
                {
                  timestamp: new Date().toISOString(),
                  message: `Attachment downloaded: ${fileName} (${fileType.toUpperCase()})`,
                  detection_method: detectedBy,
                  size_kb: Math.round(attachmentBuffer.length / 1024)
                }
              ]
            })
            .select()
            .single();

          if (inboxError) {
            console.error(`[${supplierId}] Inbox insert error:`, inboxError);
            continue;
          }

          console.log(`[${supplierId}] Created inbox entry:`, inboxData.id);

          // Trigger process-email-attachment immediately
          try {
            const processResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-email-attachment`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  inbox_id: inboxData.id,
                  user_id: userId
                })
              }
            );
            
            if (processResponse.ok) {
              console.log(`[${supplierId}] Triggered processing for inbox ${inboxData.id}`);
            } else {
              console.error(`[${supplierId}] Failed to trigger processing:`, await processResponse.text());
            }
          } catch (processError) {
            console.error(`[${supplierId}] Error triggering processing:`, processError);
          }

          // Mark as seen
          await sendCommand(`a${300 + parseInt(msgId)} STORE ${msgId} +FLAGS (\\Seen)`);
          await readResponse();

          processedCount++;
          processedEmails.push({
            id: msgId,
            from: fromEmail,
            subject: subject,
            attachment: fileName,
            inbox_id: inboxData.id
          });

        } catch (emailError) {
          console.error(`[${supplierId}] Error processing email ${msgId}:`, emailError);
        }
      }

      // Logout
      await sendCommand('a999 LOGOUT');
      await readResponse();
      conn.close();

      console.log(`[${supplierId}] Polling completed: ${processedCount}/${messageIds.length} emails processed`);

      // Log successful poll
      await supabaseAdmin.from('email_poll_logs').insert({
        user_id: userId,
        supplier_id: supplierId,
        status: processedCount > 0 ? 'emails_found' : 'no_new_emails',
        emails_found: messageIds.length,
        emails_processed: processedCount,
        details: { processed_emails: processedEmails }
      });

      return new Response(
        JSON.stringify({
          success: true,
          supplier: supplierName,
          status: processedCount > 0 ? 'emails_found' : 'no_new_emails',
          emails_found: messageIds.length,
          emails_processed: processedCount,
          processed_emails: processedEmails
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      conn.close();
      
      // 🔥 LOG ERREUR DE CONNEXION IMAP
      console.error(`[${supplierId}] IMAP Error:`, error);
      
      await supabaseAdmin.from('email_poll_logs').insert({
        user_id: userId,
        supplier_id: supplierId,
        status: 'connection_error',
        emails_found: 0,
        emails_processed: 0,
        error_message: error instanceof Error ? error.message : String(error),
        details: {
          error_type: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
        }
      });
      
      throw error;
    }

  } catch (error) {
    console.error('[IMAP-POLLER] Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAuthError = errorMessage.includes('auth') || 
                       errorMessage.includes('credential') || 
                       errorMessage.includes('login') ||
                       errorMessage.includes('password');
    
    const errorStatus = isAuthError ? 'auth_failed' : 'connection_error';
    
    // 🔥 LOG ERREUR GLOBALE si pas déjà loggué
    try {
      const body = await req.json();
      const { supplierId } = body;
      
      if (supplierId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const { data: supplier } = await supabaseAdmin
          .from('supplier_configurations')
          .select('user_id')
          .eq('id', supplierId)
          .single();
        
        if (supplier) {
          await supabaseAdmin.from('email_poll_logs').insert({
            user_id: supplier.user_id,
            supplier_id: supplierId,
            status: errorStatus,
            emails_found: 0,
            emails_processed: 0,
            error_message: errorMessage,
            details: {
              error_type: error instanceof Error ? error.name : 'Unknown'
            }
          });
        }
      }
    } catch (logError) {
      console.error('[IMAP-POLLER] Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        status: errorStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
