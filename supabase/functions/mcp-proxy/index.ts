import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { model, messages } = await req.json();

    // Récupérer la config MCP de l'utilisateur
    const { data: mcpConfig } = await supabaseClient
      .from('ai_provider_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'mcp')
      .eq('is_active', true)
      .single();

    if (!mcpConfig) {
      throw new Error('Serveur MCP non configuré');
    }

    // Appeler le serveur MCP
    const mcpResponse = await fetch(`${mcpConfig.api_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpConfig.api_key_encrypted}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'default',
        messages: messages
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server: ${mcpResponse.status}`);
    }

    const result = await mcpResponse.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in mcp-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});