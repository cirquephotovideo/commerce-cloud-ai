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

    const { packageId, toolName, args } = await req.json();

    // Récupérer la config MCP de l'utilisateur
    const { data: mcpConfig } = await supabaseClient
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', packageId)
      .eq('is_active', true)
      .eq('mcp_chat_enabled', true)
      .single();

    if (!mcpConfig) {
      throw new Error(`Package MCP ${packageId} non configuré ou désactivé`);
    }

    // Vérifier si l'outil est autorisé
    const allowedTools = mcpConfig.mcp_allowed_tools as string[] || [];
    if (allowedTools.length > 0 && !allowedTools.includes(toolName)) {
      throw new Error(`Outil ${toolName} non autorisé pour ce package`);
    }

    // Extraire les credentials depuis additional_config
    const additionalConfig = mcpConfig.additional_config as any;
    const credentials = additionalConfig?.credentials || {};

    // Router vers le bon endpoint selon le package
    let result;
    
    if (packageId.includes('odoo')) {
      result = await callOdooTool(toolName, args, credentials, mcpConfig.platform_url);
    } else if (packageId.includes('prestashop')) {
      result = await callPrestaShopTool(toolName, args, credentials, mcpConfig.platform_url);
    } else if (packageId.includes('amazon')) {
      result = await callAmazonTool(toolName, args, credentials);
    } else {
      throw new Error(`Package ${packageId} non supporté`);
    }

    // Logger l'appel dans audit_logs
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      entity_type: 'mcp_call',
      action: 'execute',
      entity_id: mcpConfig.id,
      new_values: {
        package: packageId,
        tool: toolName,
        args: args,
        success: true
      }
    });

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

async function callOdooTool(toolName: string, args: any, credentials: any, serverUrl: string) {
  console.log(`[MCP-ODOO] Calling ${toolName} with args:`, args);
  
  // Simuler un appel Odoo (à implémenter avec XML-RPC)
  return {
    success: true,
    tool: toolName,
    result: `Odoo tool ${toolName} executed successfully`,
    data: args
  };
}

async function callPrestaShopTool(toolName: string, args: any, credentials: any, serverUrl: string) {
  console.log(`[MCP-PRESTASHOP] Calling ${toolName} with args:`, args);
  
  // Exemple d'appel PrestaShop API
  if (toolName === 'get_products') {
    const apiUrl = `${serverUrl}/api/products?output_format=JSON`;
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${btoa(credentials.PRESTASHOP_API_KEY + ':')}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`PrestaShop API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      tool: toolName,
      result: 'Products retrieved successfully',
      data: data
    };
  }
  
  return {
    success: true,
    tool: toolName,
    result: `PrestaShop tool ${toolName} executed successfully`,
    data: args
  };
}

async function callAmazonTool(toolName: string, args: any, credentials: any) {
  console.log(`[MCP-AMAZON] Calling ${toolName} with args:`, args);
  
  // Simuler un appel Amazon (à implémenter avec SP-API)
  return {
    success: true,
    tool: toolName,
    result: `Amazon tool ${toolName} executed successfully`,
    data: args
  };
}
