import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';
import { getCachedOrFetch } from '../_shared/mcp-cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Définir les tools MCP disponibles par plateforme
const getMCPTools = (platforms: any[]) => {
  const tools = [];
  
  platforms.forEach(platform => {
    if (platform.platform_type === 'odoo') {
      tools.push({
        type: 'function',
        function: {
          name: 'mcp_odoo_list_products',
          description: `Liste les produits depuis Odoo (${platform.platform_name})`,
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Nombre de produits à retourner (max 100)' },
              search_term: { type: 'string', description: 'Terme de recherche optionnel' }
            }
          }
        }
      });
      
      tools.push({
        type: 'function',
        function: {
          name: 'mcp_odoo_search_products',
          description: `Recherche des produits dans Odoo par critères`,
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nom du produit' },
              category: { type: 'string', description: 'Catégorie' },
              limit: { type: 'number', description: 'Limite de résultats' }
            }
          }
        }
      });
    }
    
    if (platform.platform_type === 'prestashop') {
      tools.push({
        type: 'function',
        function: {
          name: 'mcp_prestashop_get_products',
          description: `Récupère les produits PrestaShop (${platform.platform_name})`,
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Nombre de produits' }
            }
          }
        }
      });
    }

    if (platform.platform_type === 'shopify') {
      tools.push({
        type: 'function',
        function: {
          name: 'mcp_shopify_get_products',
          description: `Récupère les produits Shopify (${platform.platform_name})`,
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Nombre de produits' }
            }
          }
        }
      });
    }

    if (platform.platform_type === 'amazon') {
      tools.push({
        type: 'function',
        function: {
          name: 'mcp_amazon_search_products',
          description: `Recherche des produits Amazon (${platform.platform_name})`,
          parameters: {
            type: 'object',
            properties: {
              keywords: { type: 'string', description: 'Mots-clés de recherche' },
              limit: { type: 'number', description: 'Nombre de résultats' }
            }
          }
        }
      });
    }
  });
  
  return tools;
};

// Fonction pour exécuter un appel MCP
const executeMCPTool = async (
  toolName: string, 
  args: any, 
  platforms: any[], 
  supabase: any,
  userId: string
) => {
  console.log(`[AI-CHAT] Executing MCP tool: ${toolName} with args:`, args);
  
  // Variables pour le logging
  const startTime = Date.now();
  let success = false;
  let responseData = null;
  let errorMessage = null;
  let cacheHit = false;
  let platformType = '';
  let action = '';
  
  try {
    // Parser le tool name pour extraire platform et action
    // Format: mcp_{platform}_{action}
    const parts = toolName.split('_');
    if (parts[0] !== 'mcp' || parts.length < 3) {
      throw new Error('Invalid MCP tool name format');
    }
    
    platformType = parts[1];
    action = parts.slice(2).join('_');
    
    // Trouver la config de la plateforme
    const platform = platforms.find(p => p.platform_type === platformType);
    if (!platform) {
      throw new Error(`Platform ${platformType} not found or not active`);
    }
    
    // Construire l'endpoint MCP selon l'action
    let endpoint = '';
    let method = 'GET';
    let body = null;
    
    if (platformType === 'odoo') {
      if (action === 'list_products') {
        endpoint = `/api/products?limit=${args.limit || 10}`;
        if (args.search_term) {
          endpoint += `&search=${encodeURIComponent(args.search_term)}`;
        }
      } else if (action === 'search_products') {
        endpoint = `/api/products/search`;
        method = 'POST';
        body = args;
      }
    } else if (platformType === 'prestashop') {
      if (action === 'get_products') {
        endpoint = `/api/products?limit=${args.limit || 10}`;
      }
    } else if (platformType === 'shopify') {
      if (action === 'get_products') {
        endpoint = `/admin/api/2024-01/products.json?limit=${args.limit || 10}`;
      }
    } else if (platformType === 'amazon') {
      if (action === 'search_products') {
        endpoint = `/api/search?keywords=${encodeURIComponent(args.keywords)}&limit=${args.limit || 10}`;
      }
    }
    
    // Utiliser le cache avec TTL de 5 minutes
    const cacheKey = `mcp_${platformType}_${action}_${JSON.stringify(args)}`;
    
    const { data: cachedData, cached } = await getCachedOrFetch(
      supabase,
      cacheKey,
      async () => {
        // Appeler mcp-proxy pour faire la requête
        const { data, error } = await supabase.functions.invoke('mcp-proxy', {
          body: {
            platform_id: platform.id,
            endpoint,
            method,
            body
          }
        });
        
        if (error) {
          console.error('[AI-CHAT] MCP tool execution error:', error);
          throw new Error(error.message || 'MCP tool execution failed');
        }
        
        return data;
      },
      5 // TTL de 5 minutes
    );
    
    // Marquer comme succès
    success = true;
    responseData = cachedData;
    cacheHit = cached;
    
    console.log(`[AI-CHAT] MCP tool result (cached: ${cached}):`, cachedData);
    return cachedData;
    
  } catch (error) {
    // Capturer l'erreur pour le logging
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI-CHAT] MCP tool execution failed:', errorMessage);
    throw error; // Re-throw pour que l'appelant gère l'erreur
    
  } finally {
    // TOUJOURS logger, même en cas d'erreur
    const latencyMs = Date.now() - startTime;
    
    console.log(`[AI-CHAT] Logging MCP call: ${toolName} (${success ? 'SUCCESS' : 'FAILED'}) - ${latencyMs}ms - Cache: ${cacheHit}`);
    
    // Insérer le log dans la base de données (non-bloquant)
    supabase
      .from('mcp_call_logs')
      .insert({
        user_id: userId,
        package_id: toolName,
        platform_type: platformType || null,
        tool_name: action || null,
        request_args: args,
        response_data: responseData,
        success,
        error_message: errorMessage,
        latency_ms: latencyMs,
        cache_hit: cacheHit
      })
      .then(({ error: logError }) => {
        if (logError) {
          console.error('[AI-CHAT] Failed to log MCP call:', logError);
        }
      });
  }
};

serve(async (req) => {
  console.log('[AI-CHAT] Request received');
  console.log('[AI-CHAT] Method:', req.method);
  console.log('[AI-CHAT] URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('[AI-CHAT] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[AI-CHAT] Request body:', JSON.stringify(body));
    
    const { message, messages = [], mcpContext, skipAICall } = body;
    
    // Mode test : validation seulement
    if (skipAICall) {
      console.log('[AI-CHAT] Test mode - skipping AI call');
      return new Response(
        JSON.stringify({ 
          response: 'Test mode successful - validation OK',
          testMode: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Récupérer l'utilisateur authentifié
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AI-CHAT] Message:', message);
    console.log('[AI-CHAT] Messages count:', messages.length);
    console.log('[AI-CHAT] MCP Context:', mcpContext);

    // Construire le contexte MCP dynamique
    let mcpContextPrompt = '';
    let platforms: any[] = [];
    let mcpTools: any[] = [];

    if (mcpContext && Array.isArray(mcpContext) && mcpContext.length > 0) {
      console.log('[AI-CHAT] MCP Context platforms:', mcpContext);
      
      // Récupérer les configurations des plateformes sélectionnées
      const { data: platformsData, error: platformError } = await supabase
        .from('platform_configurations')
        .select('*')
        .in('platform_type', mcpContext)
        .eq('is_active', true)
        .eq('user_id', user.id);

      if (platformError) {
        console.error('[AI-CHAT] Error fetching platform configs:', platformError);
      } else if (platformsData && platformsData.length > 0) {
        platforms = platformsData;
        mcpTools = getMCPTools(platforms);
        
        mcpContextPrompt = `\n\n**🔌 PLATEFORMES MCP DISPONIBLES**:\n\n`;
        
        platforms.forEach(platform => {
          mcpContextPrompt += `**${platform.platform_name}** (${platform.platform_type}):\n`;
          mcpContextPrompt += `- Outils disponibles: ${(platform.mcp_allowed_tools || []).join(', ')}\n`;
          mcpContextPrompt += `- Dernière sync: ${platform.last_sync_at ? new Date(platform.last_sync_at).toLocaleString('fr-FR') : 'jamais'}\n`;
          
          if (platform.credentials?.url) {
            mcpContextPrompt += `- URL: ${platform.credentials.url}\n`;
          }
          mcpContextPrompt += `\n`;
        });

        mcpContextPrompt += `**INSTRUCTIONS IMPORTANTES**:\n`;
        mcpContextPrompt += `- Tu PEUX utiliser ces plateformes pour répondre aux questions de l'utilisateur\n`;
        mcpContextPrompt += `- Quand l'utilisateur demande des informations sur des produits, tu dois appeler les outils appropriés\n`;
        mcpContextPrompt += `- TOUJOURS indiquer quelle plateforme tu interroges et les résultats obtenus\n`;
        mcpContextPrompt += `- Si plusieurs plateformes sont disponibles, tu peux les comparer\n\n`;
      }
    }

    // Si c'est une requête MCP, ajouter le contexte au system prompt
    let systemPrompt = `Tu es un assistant IA spécialisé dans l'e-commerce et les systèmes MCP (Multi-Channel Platforms).

**TES CAPACITÉS**:
- Analyser des produits et des données e-commerce
- Comprendre les tendances du marché
- Interroger des plateformes externes (Odoo, PrestaShop, Amazon, Shopify) via MCP
- Comparer des données entre plusieurs plateformes
- Fournir des insights business actionnables

${mcpContextPrompt}

**TON STYLE**:
- Précis et professionnel
- Orienté business et ROI
- Toujours citer tes sources (quelle plateforme, quand)
- Si tu utilises un outil MCP, explique ce que tu fais`;

    const conversationHistory = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    console.log('[AI-CHAT] Calling AI with fallback (Ollama → Lovable AI → OpenAI → OpenRouter)');
    console.log('[AI-CHAT] Conversation history length:', conversationHistory.length);
    console.log('[AI-CHAT] MCP Tools available:', mcpTools.length);

    // Si on a des tools MCP, on appelle directement Lovable AI avec tool calling
    let aiResult: { success: boolean; content?: any; provider?: string; error?: string; errorCode?: string };
    
    if (mcpTools.length > 0) {
      console.log('[AI-CHAT] Using Lovable AI with MCP tools');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: conversationHistory,
          temperature: 0.7,
          max_tokens: 2000,
          tools: mcpTools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI-CHAT] Lovable AI error:', response.status, errorText);
        throw new Error(`Lovable AI error: ${response.status}`);
      }

      const data = await response.json();
      aiResult = {
        success: true,
        content: data,
        provider: 'lovable_ai'
      };
    } else {
      // Pas de tools, utiliser le fallback normal
      aiResult = await callAIWithFallback({
        model: 'google/gemini-2.5-flash',
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000
      });
    }

    if (!aiResult.success) {
      console.error('[AI-CHAT] ❌ All providers failed:', aiResult.errorCode, aiResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          code: aiResult.errorCode || 'PROVIDER_DOWN',
          message: aiResult.errorCode === 'RATE_LIMIT'
            ? 'Limite de requêtes atteinte. Veuillez réessayer plus tard.'
            : aiResult.errorCode === 'PAYMENT_REQUIRED'
            ? 'Crédits insuffisants. Veuillez recharger votre compte.'
            : 'Tous les providers IA sont indisponibles. Réessayez plus tard.',
          provider: aiResult.provider,
          details: aiResult.error,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Gérer les tool calls dans la réponse
    if (aiResult.content?.choices?.[0]?.message?.tool_calls) {
      const toolCalls = aiResult.content.choices[0].message.tool_calls;
      console.log('[AI-CHAT] AI requested tool calls:', toolCalls);
      
      // Exécuter chaque tool call
      const toolResults = [];
      for (const toolCall of toolCalls) {
        try {
          const result = await executeMCPTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            platforms,
            supabase,
            user.id
          );
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify(result)
          });
        } catch (error) {
          console.error('[AI-CHAT] Tool execution failed:', error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
          });
        }
      }
      
      // Faire un second appel à l'IA avec les résultats des tools
      const finalConversation = [
        ...conversationHistory,
        aiResult.content.choices[0].message,
        ...toolResults
      ];
      
      const finalResult = await callAIWithFallback({
        model: 'google/gemini-2.5-flash',
        messages: finalConversation,
        temperature: 0.7,
        max_tokens: 2000
      });
      
      if (finalResult.success) {
        const finalContent = typeof finalResult.content === 'string'
          ? finalResult.content
          : finalResult.content?.choices?.[0]?.message?.content;
          
        return new Response(
          JSON.stringify({ 
            success: true, 
            response: finalContent,
            provider: finalResult.provider,
            toolsUsed: toolCalls.map(t => t.function.name)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    const content = typeof aiResult.content === 'string' 
      ? aiResult.content 
      : (aiResult.content?.choices?.[0]?.message?.content || String(aiResult.content));

    console.log('[AI-CHAT] ✅ AI response received from provider:', aiResult.provider);

    return new Response(
      JSON.stringify({ success: true, response: content, provider: aiResult.provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[AI-CHAT] Error in ai-chat function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[AI-CHAT] Error stack:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
