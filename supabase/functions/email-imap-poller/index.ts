import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple IMAP client using raw TCP
async function connectIMAP(config: {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
}) {
  const conn = await Deno.connect({ 
    hostname: config.host, 
    port: config.port,
    transport: config.ssl ? 'tcp' : 'tcp'
  });

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

  return { conn, sendCommand, readResponse };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { supplierId } = await req.json();

    if (!supplierId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'supplierId required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Récupérer le fournisseur
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('*')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      console.error('[IMAP-POLLER] Supplier not found:', supplierError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Supplier not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const config = supplier.connection_config || {};
    const emailMode = config.email_mode;

    console.log(`[IMAP-POLLER] Processing ${supplier.supplier_name} (${emailMode})`);

    let pollStatus = 'no_new_emails';
    let emailsFound = 0;
    let emailsProcessed = 0;
    let errorMessage = null;

    try {
      // Récupérer et déchiffrer le mot de passe
      const { data: credentials } = await supabase
        .from('supplier_email_credentials')
        .select('encrypted_password')
        .eq('supplier_id', supplierId)
        .single();

      let password = config.imap_password;
      if (credentials?.encrypted_password) {
        const { data: decrypted, error: decryptError } = await supabase
          .rpc('decrypt_email_password', {
            encrypted_password: credentials.encrypted_password
          });
        
        if (!decryptError && decrypted) {
          password = decrypted;
        }
      }

      if (!config.imap_host || !config.imap_email || !password) {
        throw new Error('Configuration IMAP incomplète');
      }

      // Connexion IMAP réelle
      console.log(`[IMAP-POLLER] Connecting to ${config.imap_host}:${config.imap_port || 993}`);
      
      const sessionId = crypto.randomUUID();
      const sessionCommands: string[] = [];
      const sessionResponses: string[] = [];
      
      let conn: Deno.TlsConn | Deno.Conn;
      
      // Connexion TLS
      if (config.imap_ssl !== false) {
        conn = await Deno.connectTls({
          hostname: config.imap_host,
          port: config.imap_port || 993,
        });
      } else {
        conn = await Deno.connect({
          hostname: config.imap_host,
          port: config.imap_port || 143,
        });
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      async function readResponse(): Promise<string> {
        const buffer = new Uint8Array(8192);
        let response = '';
        
        const n = await conn.read(buffer);
        if (!n) throw new Error('Connection closed');
        
        response = decoder.decode(buffer.subarray(0, n));
        sessionResponses.push(response);
        return response;
      }

      async function sendCommand(cmd: string, tag: string): Promise<string> {
        const fullCmd = `${tag} ${cmd}\r\n`;
        sessionCommands.push(fullCmd.trim());
        await conn.write(encoder.encode(fullCmd));
        return await readResponse();
      }

      // Lire le greeting
      const greeting = await readResponse();
      console.log(`[IMAP-POLLER] Connected: ${greeting.substring(0, 50)}`);
      
      if (!greeting.includes('OK')) {
        throw new Error('Serveur IMAP n\'a pas renvoyé OK');
      }

      // Obtenir les capabilities
      const capResp = await sendCommand('CAPABILITY', 'A00');
      const capabilities = capResp.toUpperCase();
      
      // Authentification (CRAM-MD5 si disponible, sinon LOGIN)
      let authSuccess = false;
      
      if (capabilities.includes('AUTH=CRAM-MD5')) {
        console.log('[IMAP-POLLER] Attempting CRAM-MD5');
        try {
          await conn.write(encoder.encode('A01 AUTHENTICATE CRAM-MD5\r\n'));
          const challengeResp = await readResponse();
          
          if (challengeResp.startsWith('+')) {
            const challengeB64 = challengeResp.substring(2).trim();
            const challenge = atob(challengeB64);
            
            // HMAC-MD5 simpliste (production devrait utiliser crypto.subtle)
            const hmac = await crypto.subtle.importKey(
              'raw',
              encoder.encode(password),
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', hmac, encoder.encode(challenge));
            const hmacHex = Array.from(new Uint8Array(signature))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            
            const response = btoa(`${config.imap_email} ${hmacHex}`);
            await conn.write(encoder.encode(response + '\r\n'));
            const authResp = await readResponse();
            
            if (authResp.includes('A01 OK')) {
              authSuccess = true;
              console.log('[IMAP-POLLER] CRAM-MD5 auth successful');
            }
          }
        } catch (e) {
          console.log('[IMAP-POLLER] CRAM-MD5 failed, trying LOGIN');
        }
      }
      
      if (!authSuccess) {
        const loginResp = await sendCommand(`LOGIN ${config.imap_email} ${password}`, 'A02');
        if (!loginResp.includes('A02 OK')) {
          throw new Error('Authentification échouée');
        }
        console.log('[IMAP-POLLER] LOGIN auth successful');
      }

      // Sélectionner le dossier
      const folder = config.imap_folder || 'INBOX';
      const selectResp = await sendCommand(`SELECT ${folder}`, 'A03');
      
      if (!selectResp.includes('A03 OK')) {
        throw new Error(`Impossible de sélectionner ${folder}`);
      }

      // Chercher les emails non lus
      const searchResp = await sendCommand('SEARCH UNSEEN', 'A04');
      const unreadIds: string[] = [];
      
      const searchMatch = searchResp.match(/\* SEARCH (.+)/);
      if (searchMatch) {
        unreadIds.push(...searchMatch[1].trim().split(' ').filter(id => id));
      }
      
      emailsFound = unreadIds.length;
      console.log(`[IMAP-POLLER] Found ${emailsFound} unread emails`);

      // Traiter chaque email
      for (const id of unreadIds) {
        try {
          // Récupérer les headers
          const headerResp = await sendCommand(`FETCH ${id} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)])`, `A05${id}`);
          
          // Récupérer la structure pour détecter les pièces jointes
          const structResp = await sendCommand(`FETCH ${id} BODYSTRUCTURE`, `A06${id}`);
          
          // Parser pour trouver les CSV/XLSX
          const hasCsv = structResp.includes('text/csv') || structResp.includes('application/vnd.ms-excel') || 
                         structResp.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          
          if (!hasCsv) {
            console.log(`[IMAP-POLLER] Email ${id}: pas de fichier CSV/XLSX, ignoré`);
            continue;
          }

          // Pour simplifier, on récupère toute la pièce jointe (partie 2 généralement)
          const bodyResp = await sendCommand(`FETCH ${id} BODY[2]`, `A07${id}`);
          
          // Extraire le contenu (très simplifié, production devrait parser MIME correctement)
          const attachmentMatch = bodyResp.match(/BODY\[2\] \{(\d+)\}\r\n([\s\S]+)/);
          if (!attachmentMatch) {
            console.log(`[IMAP-POLLER] Email ${id}: impossible d'extraire la pièce jointe`);
            continue;
          }

          const attachmentContent = attachmentMatch[2];
          const blob = new Blob([attachmentContent]);
          
          // Upload vers Storage
          const fileName = `supplier_${supplierId}_${Date.now()}.csv`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('email-attachments')
            .upload(fileName, blob, {
              contentType: 'text/csv',
              upsert: false
            });

          if (uploadError) {
            console.error(`[IMAP-POLLER] Upload error:`, uploadError);
            continue;
          }

          // Insérer dans email_inbox
          const { error: inboxError } = await supabase
            .from('email_inbox')
            .insert({
              user_id: supplier.user_id,
              supplier_id: supplierId,
              from_email: config.imap_email,
              subject: `Import automatique via IMAP`,
              detection_method: 'imap_polling',
              attachment_url: uploadData.path,
              attachment_name: fileName,
              status: 'pending'
            });

          if (inboxError) {
            console.error(`[IMAP-POLLER] Insert inbox error:`, inboxError);
            continue;
          }

          // Marquer comme lu
          await sendCommand(`STORE ${id} +FLAGS (\\Seen)`, `A08${id}`);
          
          emailsProcessed++;
          console.log(`[IMAP-POLLER] Email ${id} traité avec succès`);
        } catch (emailError) {
          console.error(`[IMAP-POLLER] Error processing email ${id}:`, emailError);
        }
      }

      // Déconnexion
      await sendCommand('LOGOUT', 'A99');
      conn.close();

      // Sauvegarder les logs de session
      await supabase.from('imap_session_logs').insert({
        supplier_id: supplierId,
        user_id: supplier.user_id,
        session_start: new Date().toISOString(),
        session_end: new Date().toISOString(),
        commands_sent: sessionCommands,
        server_responses: sessionResponses,
        status: 'success'
      });

      pollStatus = emailsFound > 0 ? 'emails_found' : 'no_new_emails';
      
      // Log du poll
      await supabase
        .from('email_poll_logs')
        .insert({
          supplier_id: supplierId,
          user_id: supplier.user_id,
          status: pollStatus,
          emails_found: emailsFound,
          emails_processed: emailsProcessed,
          details: {
            host: config.imap_host,
            folder: config.imap_folder || 'INBOX'
          }
        });

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IMAP-POLLER] Error:`, error);
      
      pollStatus = errorMessage.includes('auth') || errorMessage.includes('password') 
        ? 'auth_failed' 
        : 'connection_error';
      
      // Log l'erreur
      await supabase
        .from('email_poll_logs')
        .insert({
          supplier_id: supplierId,
          user_id: supplier.user_id,
          status: pollStatus,
          emails_found: 0,
          emails_processed: 0,
          error_message: errorMessage,
          details: { error: errorMessage }
        });
    }

    return new Response(JSON.stringify({
      success: pollStatus !== 'auth_failed' && pollStatus !== 'connection_error',
      supplier_id: supplierId,
      supplier_name: supplier.supplier_name,
      status: pollStatus,
      emails_found: emailsFound,
      emails_processed: emailsProcessed,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[IMAP-POLLER] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
