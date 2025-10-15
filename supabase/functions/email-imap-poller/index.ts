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
      // Récupérer les credentials sécurisés
      const { data: credentials } = await supabase
        .from('supplier_email_credentials')
        .select('encrypted_password')
        .eq('supplier_id', supplierId)
        .single();

      const password = credentials?.encrypted_password || config.imap_password;

      if (!config.imap_host || !config.imap_email || !password) {
        throw new Error('Configuration IMAP incomplète');
      }

      // TODO: Implémenter la vraie logique IMAP
      // Pour l'instant, placeholder qui simule une vérification
      console.log(`[IMAP-POLLER] Would connect to ${config.imap_host}:${config.imap_port || 993}`);
      
      // Simulation: pas de nouveaux emails pour l'instant
      pollStatus = 'no_new_emails';
      
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
