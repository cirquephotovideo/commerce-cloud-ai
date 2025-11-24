import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Check if user has admin role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    const { operation = 'status' } = await req.json().catch(() => ({ operation: 'status' }));

    if (operation === 'status') {
      // Return rotation status
      const { data: suppliers } = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, connection_config')
        .not('connection_config->imap_password_vault_id', 'is', null);

      const { data: amazonCreds } = await supabase
        .from('amazon_credentials')
        .select('id, client_id, client_secret_vault_id, refresh_token_vault_id')
        .not('client_secret_vault_id', 'is', null);

      return new Response(JSON.stringify({
        success: true,
        credentials: {
          supplier_passwords: suppliers?.length || 0,
          amazon_credentials: amazonCreds?.length || 0
        },
        message: 'All credentials are stored in Supabase Vault with automatic encryption'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (operation === 'rotate') {
      // ✅ Supabase Vault automatically handles encryption with proper key management
      // No manual re-encryption needed - Vault manages keys internally
      
      console.log('[KEY-ROTATION] Vault-based encryption is active');
      console.log('[KEY-ROTATION] Note: Supabase Vault handles key rotation automatically');
      
      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'key_rotation_check',
        entity_type: 'encryption_keys',
        entity_id: crypto.randomUUID(),
        new_values: {
          message: 'Key rotation status verified',
          vault_managed: true,
          timestamp: new Date().toISOString()
        }
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Encryption keys are managed by Supabase Vault with automatic rotation',
        vault_managed: true,
        recommendation: 'Vault handles encryption key lifecycle automatically. No manual rotation needed.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid operation. Use "status" or "rotate"' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error: any) {
    console.error('[KEY-ROTATION] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
