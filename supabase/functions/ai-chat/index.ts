import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    console.log('[AI-CHAT] Message:', message);
    console.log('[AI-CHAT] Messages count:', messages.length);
    console.log('[AI-CHAT] MCP Context:', mcpContext);

    // Si c'est une requête MCP, ajouter le contexte au system prompt
    let systemPrompt = `Tu es un assistant IA spécialisé dans l'e-commerce. Tu aides les utilisateurs à analyser des produits, 
    comprendre les tendances du marché, et optimiser leur stratégie commerciale. Tu as accès à la recherche web pour 
    fournir des informations à jour. Sois précis, professionnel et orienté business dans tes réponses.`;
    
    if (mcpContext?.packageId && mcpContext?.toolName) {
      systemPrompt += `\n\nTu as également accès à des outils MCP pour interagir avec ${mcpContext.packageId}. 
      L'utilisateur peut utiliser la commande /mcp <package> <tool> [args] pour appeler ces outils directement.`;
    }

    const conversationHistory = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    console.log('[AI-CHAT] Calling AI with fallback (Ollama → Lovable AI → OpenAI → OpenRouter)');
    console.log('[AI-CHAT] Conversation history length:', conversationHistory.length);

    const aiResult = await callAIWithFallback({
      model: 'gpt-oss:20b-cloud',
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 2000,
    });

    if (!aiResult.success) {
      console.error('[AI-CHAT] ❌ All providers failed:', aiResult.errorCode, aiResult.error);
      // Normalize to 200 to avoid generic non-2xx errors in clients
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
