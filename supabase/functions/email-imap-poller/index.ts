import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HMAC-MD5 utility for CRAM-MD5 authentication
async function hmacMd5(key: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const messageData = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'MD5' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

      // Authenticate with CRAM-MD5 (using HMAC-MD5) with fallback
      let authResponse = '';
      let usedUsername = '';
      
      if (capabilityResponse.includes('AUTH=CRAM-MD5')) {
        // Try 3 variants: username > email > local-part
        const authVariants = [
          imapUsername || null,  // Explicit username if provided
          imapEmail,             // Full email
          imapEmail.split('@')[0] // Local part before @
        ].filter(Boolean);
        
        console.log(`[${supplierId}] Attempting CRAM-MD5 with ${authVariants.length} username variants`);
        
        for (const variant of authVariants) {
          try {
            await sendCommand('a002 AUTHENTICATE CRAM-MD5');
            const challengeResponse = await readResponse();
            
            const challengeMatch = challengeResponse.match(/\+ (.+)/);
            if (challengeMatch) {
              const challenge = atob(challengeMatch[1]);
              const hmacHex = await hmacMd5(imapPassword, challenge);
              const response = btoa(`${variant} ${hmacHex}`);
              
              await sendCommand(response);
              authResponse = await readResponse();
              
              if (authResponse.includes('a002 OK')) {
                usedUsername = variant;
                console.log(`[${supplierId}] ✅ CRAM-MD5 succeeded with username: ${variant}`);
                break;
              } else {
                console.log(`[${supplierId}] CRAM-MD5 failed with username: ${variant}`);
              }
            }
          } catch (cramError) {
            console.warn(`[${supplierId}] CRAM-MD5 error with ${variant}:`, cramError);
          }
        }
        
        if (!authResponse.includes('a002 OK')) {
          console.log(`[${supplierId}] All CRAM-MD5 attempts failed, falling back to LOGIN`);
        }
      }

      // Fallback to LOGIN if CRAM-MD5 not available or failed
      if (!authResponse.includes('OK')) {
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
              attempted_user: imapEmail,
              server_response: authResponse,
              error: 'Authentication failed with all methods'
            }
          });
          
          throw new Error('Authentication failed');
        }
        usedUsername = imapEmail;
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
