// IMAP Email Poller - Version 2.1.1 (Native MD5/HMAC-MD5 Implementation - DEPLOYMENT FORCED)
// Last updated: 2025-10-15 16:16:00 UTC
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log('[IMAP-POLLER] Starting Version 2.1.1 with native MD5/HMAC-MD5');

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
    const { supplierId } = await req.json();

    if (!supplierId) {
      return new Response(
        JSON.stringify({ success: false, error: 'supplierId required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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

      // Authenticate with CRAM-MD5 with fallback username variants
      let authResponse = '';
      let usedUsername = '';
      let authAttempts: any[] = [];
      const loginDisabled = capabilityResponse.includes('LOGINDISABLED');
      
      if (capabilityResponse.includes('AUTH=CRAM-MD5')) {
        // Try 3 variants: username > email > local-part
        const authVariants = [
          imapUsername || null,          // Explicit username if provided
          imapEmail,                     // Full email
          imapEmail.split('@')[0]        // Local part before @
        ].filter(Boolean) as string[];
        
        console.log(`[${supplierId}] Attempting CRAM-MD5 with ${authVariants.length} username variants`);
        console.log(`[${supplierId}] Variants to test:`, authVariants);
        
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
                username: variant,
                challenge: challenge,
                hmac_preview: hmacHex.substring(0, 20),
                response: authResponse.substring(0, 100)
              });
              
              if (authResponse.includes('a002 OK')) {
                usedUsername = variant;
                console.log(`[${supplierId}] ✅ CRAM-MD5 succeeded with username: ${variant}`);
                break;
              } else {
                console.log(`[${supplierId}] ❌ CRAM-MD5 failed with username: ${variant}`);
                console.log(`[${supplierId}] Server response: ${authResponse.substring(0, 200)}`);
              }
            }
          } catch (cramError) {
            console.warn(`[${supplierId}] CRAM-MD5 error with ${variant}:`, cramError);
            authAttempts.push({
              username: variant,
              error: cramError instanceof Error ? cramError.message : String(cramError)
            });
          }
        }
        
        if (!authResponse.includes('a002 OK')) {
          console.log(`[${supplierId}] All CRAM-MD5 attempts failed`);
          
          if (loginDisabled) {
            // Do NOT try LOGIN if server has LOGINDISABLED
            console.log(`[${supplierId}] LOGIN is disabled on server, cannot fallback`);
            
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
                error: 'CRAM-MD5 authentication failed with all username variants. LOGIN is disabled by server.'
              }
            });
            
            throw new Error('Authentication failed: CRAM-MD5 failed with all variants and LOGIN is disabled');
          }
        }
      }

      // Fallback to LOGIN ONLY if CRAM-MD5 not available or failed AND LOGIN is not disabled
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

      console.log(`[${supplierId}] ✅ Authentication successful (user: ${usedUsername})`);

      // Select mailbox
      await sendCommand(`a004 SELECT "${imapFolder}"`);
      const selectResponse = await readResponse();
      
      if (!selectResponse.includes('OK')) {
        throw new Error(`Failed to select folder: ${imapFolder}`);
      }

      // Search for recent messages (last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const searchDate = threeDaysAgo.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }).replace(/ /g, '-');
      
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
          
          // Look for CSV/XLSX attachments
          const attachmentRegex = /"(?:attachment|inline)"[^)]*"(?:filename|name)"\s+"?([^")\s]+\.(csv|xlsx|xls))"?/gi;
          const attachments = [];
          let match;
          
          while ((match = attachmentRegex.exec(bodyStruct)) !== null) {
            attachments.push({
              filename: match[1],
              type: match[2].toLowerCase()
            });
          }

          if (attachments.length === 0) {
            console.log(`[${supplierId}] Email ${msgId}: No CSV/XLSX attachments found`);
            continue;
          }

          console.log(`[${supplierId}] Email ${msgId}: Found ${attachments.length} attachment(s):`, attachments.map(a => a.filename));

          // Fetch attachment content (simplified: assume part 2)
          const partNumber = '2';
          
          await sendCommand(`a${200 + parseInt(msgId)} FETCH ${msgId} BODY[${partNumber}]`);
          let bodyContent = '';
          chunk = await readResponse();
          bodyContent += chunk;
          
          while (!chunk.includes(`a${200 + parseInt(msgId)} OK`)) {
            chunk = await readResponse();
            bodyContent += chunk;
          }

          const contentMatch = bodyContent.match(/BODY\[[\d.]+\]\s+(?:\{[\d]+\}\r?\n)?([A-Za-z0-9+/=\s]+)/is);
          
          if (!contentMatch) {
            console.log(`[${supplierId}] Email ${msgId}: Could not extract attachment content`);
            continue;
          }

          const base64Content = contentMatch[1].replace(/[\r\n\s]/g, '');
          const attachmentBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

          const fileName = attachments[0].filename;
          const fileType = attachments[0].type === 'csv' ? 'csv' : 'xlsx';

          console.log(`[${supplierId}] Email ${msgId}: Decoded ${fileName}, size: ${attachmentBuffer.length} bytes`);

          // Upload to Storage
          const timestamp = new Date().getTime();
          const storagePath = `${userId}/${supplierId}/${timestamp}-${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('email-attachments')
            .upload(storagePath, attachmentBuffer, {
              contentType: fileType === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              upsert: false
            });

          if (uploadError) {
            console.error(`[${supplierId}] Upload error for email ${msgId}:`, uploadError);
            continue;
          }

          console.log(`[${supplierId}] Uploaded to Storage:`, uploadData.path);

          // Insert into email_inbox
          const { data: inboxData, error: inboxError } = await supabaseAdmin
            .from('email_inbox')
            .insert({
              user_id: userId,
              supplier_id: supplierId,
              from_email: fromEmail,
              subject: subject,
              attachment_name: fileName,
              attachment_type: fileType,
              attachment_url: uploadData.path,
              attachment_size_kb: Math.round(attachmentBuffer.length / 1024),
              status: 'pending',
              detection_method: 'imap_poll',
              detected_supplier_name: supplierName
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
