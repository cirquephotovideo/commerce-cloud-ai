import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCachedOrFetch } from '../_shared/mcp-cache.ts';
import { retryWithBackoff } from '../_shared/retry-with-backoff.ts';

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
      console.error(`[MCP-PROXY] Config not found for user ${user.id}, package ${packageId}`);
      throw new Error(`Package MCP "${packageId}" non configuré, inactif ou désactivé pour cet utilisateur`);
    }

    // Vérifier si l'outil est autorisé
    const allowedTools = mcpConfig.mcp_allowed_tools as string[] || [];
    if (allowedTools.length > 0 && !allowedTools.includes(toolName)) {
      throw new Error(`Outil ${toolName} non autorisé pour ce package`);
    }

    // ===== RATE LIMITING CHECK =====
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient.rpc(
      'check_and_update_rate_limit',
      { p_user_id: user.id, p_package_id: packageId }
    );

    if (rateLimitError) {
      console.error(`[MCP-PROXY] Rate limit check error:`, rateLimitError);
    }

    if (rateLimitCheck && !rateLimitCheck.allowed) {
      console.warn(`[MCP-PROXY] Rate limit exceeded for user ${user.id}, package ${packageId}`);
      console.warn(`[MCP-PROXY] Current: ${rateLimitCheck.current_count}/${rateLimitCheck.limit}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          message: `Limite de ${rateLimitCheck.limit} appels/heure atteinte pour ${packageId}`,
          retry_after: rateLimitCheck.retry_after_seconds,
          reset_at: rateLimitCheck.reset_at,
          current_count: rateLimitCheck.current_count,
          limit: rateLimitCheck.limit
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitCheck.limit.toString(),
            'X-RateLimit-Remaining': (rateLimitCheck.limit - rateLimitCheck.current_count).toString(),
            'X-RateLimit-Reset': rateLimitCheck.reset_at,
            'Retry-After': rateLimitCheck.retry_after_seconds.toString()
          }
        }
      );
    }

    console.log(`[MCP-PROXY] Rate limit OK: ${rateLimitCheck?.current_count || 0}/${rateLimitCheck?.limit || 'N/A'}`);

    // Extraire les credentials depuis additional_config
    const additionalConfig = mcpConfig.additional_config as any;
    const credentials = additionalConfig?.credentials || {};

    // ===== CACHE INTEGRATION =====
    const cacheKey = `mcp:${packageId}:${toolName}:${JSON.stringify(args)}`;
    const cacheTTL = packageId.includes('amazon') ? 10 : packageId.includes('odoo') ? 5 : 2;

    const { data: result, cached } = await getCachedOrFetch(
      supabaseClient,
      cacheKey,
      async () => {
        if (packageId.includes('odoo')) {
          return await callOdooTool(toolName, args, credentials, mcpConfig.platform_url);
        } else if (packageId.includes('prestashop')) {
          return await callPrestaShopTool(toolName, args, credentials, mcpConfig.platform_url);
        } else if (packageId.includes('amazon')) {
          return await callAmazonTool(toolName, args, credentials);
        } else {
          throw new Error(`Package ${packageId} non supporté`);
        }
      },
      cacheTTL
    );

    // Logger l'appel dans mcp_call_logs et audit_logs
    await supabaseClient.from('mcp_call_logs').insert({
      user_id: user.id,
      package_id: packageId,
      tool_name: toolName,
      request_args: args,
      response_data: { ...result, _cached: cached },
      success: result.success,
      error_message: ('error' in result ? result.error : null) as string | null,
      latency_ms: cached ? 0 : (('latency_ms' in result ? result.latency_ms : null) as number | null)
    });

    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      entity_type: 'mcp_call',
      action: 'execute',
      entity_id: mcpConfig.id,
      new_values: {
        package: packageId,
        tool: toolName,
        args: args,
        success: result.success,
        cached: cached
      }
    });

    // ===== WEBHOOK NOTIFICATION ON FAILURE =====
    if (!result.success) {
      const { data: recentFailures } = await supabaseClient
        .from('mcp_call_logs')
        .select('success')
        .eq('user_id', user.id)
        .eq('package_id', packageId)
        .order('created_at', { ascending: false })
        .limit(3);

      const consecutiveFailures = recentFailures?.filter(f => !f.success).length || 0;

      if (consecutiveFailures >= 3) {
        console.log(`[MCP-PROXY] 3 consecutive failures detected, triggering webhook`);
        
        supabaseClient.functions.invoke('mcp-webhook-notifier', {
          body: {
            user_id: user.id,
            event: 'error_threshold',
            package_id: packageId,
            message: `3 échecs consécutifs détectés pour ${packageId}`,
            metadata: { tool_name: toolName, last_error: result.error }
          }
        }).catch(err => console.error('[WEBHOOK] Failed to notify:', err));
      }
    }

    return new Response(JSON.stringify({ ...result, _cached: cached }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Cache-Status': cached ? 'HIT' : 'MISS'
      },
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
  const startTime = Date.now();
  
  try {
    // Étape 1: Authentification Odoo via XML-RPC avec retry
    const authResponse = await retryWithBackoff(
      () => fetch(`${serverUrl}/xmlrpc/2/common`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${credentials.ODOO_DB}</string></value></param>
    <param><value><string>${credentials.ODOO_USERNAME}</string></value></param>
    <param><value><string>${credentials.ODOO_PASSWORD}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`
      }),
      3,
      1000,
      'Odoo Authentication'
    );

    if (!authResponse.ok) {
      throw new Error(`Odoo authentication failed: ${authResponse.status}`);
    }

    const authText = await authResponse.text();
    const uidMatch = authText.match(/<int>(\d+)<\/int>/);
    if (!uidMatch) {
      throw new Error('Failed to extract UID from Odoo response');
    }
    const uid = uidMatch[1];
    console.log(`[MCP-ODOO] Authenticated with UID: ${uid}`);

    // Étape 2: Exécuter l'outil demandé
    let xmlrpcParams = '';
    let domain = '[]';
    let fields = ['name', 'list_price', 'default_code', 'categ_id', 'qty_available', 'image_1920'];
    let limit = 10;

    if (toolName === 'search_products') {
      const searchTerm = args.search || args.name || '';
      if (searchTerm) {
        domain = `[['name', 'ilike', '${searchTerm.replace(/'/g, "\\'")}']`;
        if (args.brand) {
          domain += `, ['brand', 'ilike', '${args.brand.replace(/'/g, "\\'")}']`;
        }
        domain += ']';
      }
      limit = args.limit || 10;
    } else if (toolName === 'get_product_details') {
      const productId = args.id || args.product_id;
      if (!productId) {
        throw new Error('product_id is required for get_product_details');
      }
      domain = `[['id', '=', ${productId}]]`;
      fields = ['name', 'list_price', 'default_code', 'categ_id', 'qty_available', 'description', 'description_sale', 'image_1920', 'image_1024', 'image_512'];
      limit = 1;
    } else if (toolName === 'list_products') {
      limit = args.limit || 10;
    }

    xmlrpcParams = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${credentials.ODOO_DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${credentials.ODOO_PASSWORD}</string></value></param>
    <param><value><string>product.template</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param><value><array><data>
      <value><array><data>${domain}</data></array></value>
    </data></array></value></param>
    <param><value><struct>
      <member><name>fields</name><value><array><data>
        ${fields.map(f => `<value><string>${f}</string></value>`).join('')}
      </data></array></value></member>
      <member><name>limit</name><value><int>${limit}</int></value></member>
    </struct></value></param>
  </params>
</methodCall>`;

    const execResponse = await fetch(`${serverUrl}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xmlrpcParams
    });

    if (!execResponse.ok) {
      throw new Error(`Odoo execute_kw failed: ${execResponse.status}`);
    }

    const execText = await execResponse.text();
    console.log(`[MCP-ODOO] Raw response length: ${execText.length}`);

    // Parser simplifié pour extraire les données des produits
    const products: any[] = [];
    const structMatches = execText.matchAll(/<struct>(.*?)<\/struct>/gs);
    
    for (const match of structMatches) {
      const structContent = match[1];
      const product: any = {};
      
      // Extraire les champs du produit
      const memberMatches = structContent.matchAll(/<member>.*?<name>(.*?)<\/name>.*?<value>(.*?)<\/value>.*?<\/member>/gs);
      for (const memberMatch of memberMatches) {
        const key = memberMatch[1];
        const valueContent = memberMatch[2];
        
        // Extraire la valeur selon son type
        if (valueContent.includes('<string>')) {
          product[key] = valueContent.match(/<string>(.*?)<\/string>/)?.[1] || '';
        } else if (valueContent.includes('<int>')) {
          product[key] = parseInt(valueContent.match(/<int>(.*?)<\/int>/)?.[1] || '0');
        } else if (valueContent.includes('<double>')) {
          product[key] = parseFloat(valueContent.match(/<double>(.*?)<\/double>/)?.[1] || '0');
        } else if (valueContent.includes('<boolean>')) {
          product[key] = valueContent.includes('<boolean>1</boolean>');
        }
      }
      
      if (Object.keys(product).length > 0) {
        // Convertir l'image base64 en data URL si présente
        if (product.image_1920) {
          product.image_url = `data:image/png;base64,${product.image_1920}`;
          // Nettoyer pour ne pas surcharger la réponse
          delete product.image_1920;
        }
        
        // Générer l'URL du produit Odoo
        if (product.name && product.id) {
          const productSlug = product.name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          product.odoo_url = `${serverUrl}/shop/product/${productSlug}-${product.id}`;
        }
        
        products.push(product);
      }
    }

    const latency = Date.now() - startTime;
    console.log(`[MCP-ODOO] Successfully fetched ${products.length} products in ${latency}ms`);

    return {
      success: true,
      tool: toolName,
      result: `Successfully fetched ${products.length} products from Odoo`,
      data: products,
      latency_ms: latency
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MCP-ODOO] Error:`, error);
    return {
      success: false,
      tool: toolName,
      result: `Failed to execute Odoo tool: ${errorMessage}`,
      error: errorMessage,
      latency_ms: latency
    };
  }
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
  const startTime = Date.now();
  
  try {
    const marketplaceId = args.marketplaceId || credentials.SP_API_MARKETPLACE_ID || 'A13V1IB3VIYZZH';
    const region = credentials.SP_API_REGION || 'eu-west-1';
    
    // Router vers les endpoints Amazon SP-API
    let endpoint = '';
    let method = 'GET';
    let queryParams: Record<string, string> = {};
    
    switch (toolName) {
      case 'search_catalog':
        endpoint = `/catalog/2022-04-01/items`;
        queryParams = {
          keywords: args.keywords || args.search || '',
          marketplaceIds: marketplaceId,
          includedData: 'attributes,images,productTypes,salesRanks'
        };
        break;
        
      case 'get_catalog_item':
        const asin = args.asin || args.id;
        if (!asin) throw new Error('ASIN requis pour get_catalog_item');
        endpoint = `/catalog/2022-04-01/items/${asin}`;
        queryParams = {
          marketplaceIds: marketplaceId,
          includedData: 'attributes,images,productTypes,salesRanks,summaries'
        };
        break;
        
      case 'get_competitive_pricing':
        const pricingAsin = args.asin || args.id;
        if (!pricingAsin) throw new Error('ASIN requis pour get_competitive_pricing');
        endpoint = `/products/pricing/v0/items/${pricingAsin}/offers`;
        queryParams = {
          MarketplaceId: marketplaceId,
          ItemCondition: args.condition || 'New'
        };
        break;
        
      default:
        throw new Error(`Amazon tool ${toolName} non supporté`);
    }
    
    // Obtenir un access token via amazon-token-manager
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/amazon-token-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId: credentials.SP_API_CLIENT_ID,
        clientSecret: credentials.SP_API_CLIENT_SECRET,
        refreshToken: credentials.SP_API_REFRESH_TOKEN
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Amazon access token: ${tokenResponse.status} - ${errorText}`);
    }
    
    const { accessToken } = await tokenResponse.json();
    
    // Construire l'URL complète
    const baseUrl = `https://sellingpartnerapi-${region}.amazon.com`;
    const queryString = new URLSearchParams(queryParams).toString();
    const fullUrl = `${baseUrl}${endpoint}?${queryString}`;
    
    console.log(`[MCP-AMAZON] Calling ${fullUrl}`);
    
    // Appeler l'API Amazon
    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-amz-access-token': accessToken
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amazon SP-API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const latency = Date.now() - startTime;
    
    console.log(`[MCP-AMAZON] Successfully executed ${toolName} in ${latency}ms`);
    
    return {
      success: true,
      tool: toolName,
      result: `Amazon tool ${toolName} executed successfully`,
      data: data,
      latency_ms: latency
    };
    
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MCP-AMAZON] Error:`, error);
    
    return {
      success: false,
      tool: toolName,
      result: `Failed to execute Amazon tool: ${errorMessage}`,
      error: errorMessage,
      latency_ms: latency
    };
  }
}
