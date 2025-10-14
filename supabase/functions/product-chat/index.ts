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
    const { message, productId } = await req.json();
    
    console.log('📨 Requête reçue:', { 
      mode: productId ? `produit (${productId})` : 'général',
      messageLength: message?.length 
    });
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token and extract access token explicitly
    const authHeader = req.headers.get('Authorization') || '';
    console.log('🔐 Authorization header present:', !!authHeader, 'len:', authHeader.length);
    
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      console.error('❌ Token Bearer invalide ou manquant');
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const accessToken = tokenMatch[1];

    // Initialize Supabase client with explicit token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      }
    );

    let systemPrompt = `Tu es un assistant e-commerce expert qui aide les utilisateurs à analyser leurs produits.
Sois concis, précis et orienté business. Réponds en français.`;

    // If productId is provided, try to use pre-computed context
    if (productId) {
      console.log('📦 Checking for product context:', productId);
      
      // Try to fetch pre-computed context (RLS will handle user filtering)
      const { data: contextData, error: contextError } = await supabaseClient
        .from('product_chat_contexts')
        .select('context_text, status, last_built_at')
        .eq('product_id', productId)
        .maybeSingle();

      if (contextData && contextData.status === 'ready') {
        console.log('✅ Using pre-computed context');
        systemPrompt = `Tu es un assistant e-commerce expert. Voici les informations sur le produit concerné:

${contextData.context_text}

Réponds aux questions de l'utilisateur en t'appuyant uniquement sur ces informations. Sois concis, précis et orienté business. Réponds en français.`;
      } else {
        console.log('⚠️ No ready context found, will use live fetch fallback');
        
        // Fallback: fetch product data live (RLS will handle user filtering)
        const { data: product, error: productError } = await supabaseClient
          .from('product_analyses')
          .select(`
            *,
            supplier_products!inner(id, supplier_id, purchase_price, stock_quantity),
            amazon_product_data(*)
          `)
          .eq('id', productId)
          .maybeSingle();

        if (productError) {
          console.error('❌ Product fetch error:', productError);
          return new Response(
            JSON.stringify({ error: 'Erreur lors de la récupération du produit' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!product) {
          console.log('❌ Product not found or not accessible');
          return new Response(
            JSON.stringify({ error: 'Produit introuvable ou non accessible' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ Using live product data');
        
        // Build a simplified context from live data
        const contextParts: string[] = [];
        contextParts.push(`EAN: ${product.ean || 'N/A'}`);
        contextParts.push(`Nom: ${product.product_name || product.name || 'N/A'}`);
        if (product.purchase_price) contextParts.push(`Prix d'achat: ${product.purchase_price}€`);
        if (product.analysis_result?.price) contextParts.push(`Prix de vente: ${product.analysis_result.price}€`);
        if (product.margin_percentage) contextParts.push(`Marge: ${product.margin_percentage}%`);
        
        systemPrompt = `Tu es un assistant e-commerce expert. Voici les informations sur le produit:

${contextParts.join('\n')}

Réponds aux questions en t'appuyant sur ces informations. Sois concis et orienté business. Réponds en français.`;

        // Optionally trigger background context build (not awaited)
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/build-product-chat-context`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ productId }),
        }).catch(err => console.error('Background context build failed:', err));
      }
    }

    // Appeler Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY non configuré');
    }

    console.log('📤 Appel Lovable AI:', { 
      mode: productId ? `produit ${productId}` : 'général',
      systemPromptLength: systemPrompt.length,
      messageLength: message.length
    });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erreur Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte. Réessayez dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits insuffisants. Veuillez recharger votre compte Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erreur API: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('Réponse IA vide');
    }

    console.log('✅ Réponse IA générée');

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erreur product-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne du serveur';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
