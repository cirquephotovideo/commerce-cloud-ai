import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    console.log('[AI-CHAT] LOVABLE_API_KEY present:', !!LOVABLE_API_KEY);
    
    if (!LOVABLE_API_KEY) {
      console.error('[AI-CHAT] LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const conversationHistory = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages,
      { role: 'user', content: message }
    ];

    console.log('[AI-CHAT] Calling Lovable AI Gateway...');
    console.log('[AI-CHAT] Conversation history length:', conversationHistory.length);
    
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
      }),
    });

    console.log('[AI-CHAT] Response status:', response.status);
    console.log('[AI-CHAT] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-CHAT] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte. Veuillez réessayer plus tard.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits insuffisants. Veuillez recharger votre compte.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 402,
          }
        );
      }
      
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[AI-CHAT] AI response received successfully');
    
    const aiResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
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
