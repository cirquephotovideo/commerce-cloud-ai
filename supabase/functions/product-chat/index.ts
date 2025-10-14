import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Détection intelligente des requêtes MCP
interface MCPDetection {
  needsMCP: boolean;
  packageId?: string;
  toolName?: string;
  args?: any;
}

function detectMCPRequest(message: string): MCPDetection {
  const messageLower = message.toLowerCase();

  // Patterns Odoo - détecter les requêtes concernant des produits dans Odoo
  const odooPatterns = [
    /(?:liste|lister|affiche|montre|donne).*produits?.*(?:depuis|dans|de|odoo)/i,
    /produits?.*(?:sony|samsung|apple|lg|philips|bosch|siemens).*odoo/i,
    /odoo.*produits?.*(?:sony|samsung|apple|lg|philips|bosch|siemens)/i,
    /recherche.*produits?.*odoo/i,
    /combien.*produits?.*odoo/i,
  ];

  if (odooPatterns.some(pattern => pattern.test(messageLower))) {
    console.log('✅ Détection Odoo positive pour:', message);
    
    let toolName = 'list_products';
    const args: any = { limit: 10 };

    // Extraire la marque/terme de recherche
    const brandMatch = message.match(/(?:sony|samsung|apple|lg|philips|bosch|siemens|microsoft|hp|dell|lenovo|asus|acer)/gi);
    if (brandMatch && brandMatch[0]) {
      toolName = 'search_products';
      args.search = brandMatch[0];
      args.brand = brandMatch[0];
      console.log('🔍 Recherche détectée pour marque:', brandMatch[0]);
    }

    // Détection de limite
    const limitMatch = messageLower.match(/(\d+)\s*produits?/);
    if (limitMatch) {
      args.limit = parseInt(limitMatch[1]);
      console.log('📊 Limite détectée:', args.limit);
    }

    return {
      needsMCP: true,
      packageId: 'odoo',
      toolName,
      args
    };
  }

  return { needsMCP: false };
}

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

    // Détecter si la requête nécessite un appel MCP
    const mcpDetection = detectMCPRequest(message);
    console.log('🔍 MCP Detection:', mcpDetection);

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

    let systemPrompt = `Tu es un assistant e-commerce expert qui aide les utilisateurs à analyser leurs produits et à interroger leur système de gestion.

IMPORTANT : Quand l'utilisateur parle de "produits Sony depuis Odoo" ou "produits dans Odoo", il fait référence à :
- Odoo = leur système ERP/base de données de gestion d'entreprise
- "Produits Sony dans Odoo" = les produits de la marque Sony qui sont stockés dans leur base de données Odoo

Tu dois comprendre que l'utilisateur veut interroger SA base de données Odoo pour obtenir SES produits de marque Sony.

Sois concis, précis et orienté business. Réponds en français.`;

    // Si MCP détecté, enrichir le contexte
    let mcpContext = '';
    if (mcpDetection.needsMCP) {
      console.log(`🚀 Appel MCP: ${mcpDetection.packageId} - ${mcpDetection.toolName} avec args:`, mcpDetection.args);
      
      try {
        const mcpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mcp-proxy`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packageId: mcpDetection.packageId,
            toolName: mcpDetection.toolName,
            args: mcpDetection.args
          }),
        });

        if (mcpResponse.ok) {
          const mcpData = await mcpResponse.json();
          console.log('✅ Données MCP reçues:', { 
            success: mcpData.success,
            productsCount: mcpData.data?.length || 0,
            tool: mcpData.tool
          });
          
          if (mcpData.data && Array.isArray(mcpData.data) && mcpData.data.length > 0) {
            const productsInfo = mcpData.data.map((p: any) => 
              `- ${p.name || 'Sans nom'} (Prix: ${p.list_price || 'N/A'}€, Stock: ${p.qty_available || 0}, Réf: ${p.default_code || 'N/A'})`
            ).join('\n');
            
            mcpContext = `\n\n📦 DONNÉES DEPUIS ODOO (${mcpData.data.length} produits trouvés):\n${productsInfo}\n\nRéponds à l'utilisateur en te basant sur ces données réelles extraites de son système Odoo.`;
            
            systemPrompt = `Tu es un assistant e-commerce expert connecté au système Odoo de l'utilisateur.

L'utilisateur a demandé des informations sur des produits stockés dans son système Odoo.
Voici les données extraites de son Odoo:

${mcpContext}

Présente ces résultats de manière claire et professionnelle. Si l'utilisateur a demandé des produits d'une marque spécifique (ex: Sony), précise combien de produits correspondent à sa recherche.

Réponds en français de manière concise et orientée business.`;
          } else {
            console.log('⚠️ Aucun produit trouvé dans Odoo');
            systemPrompt = `Tu es un assistant e-commerce expert connecté au système Odoo de l'utilisateur.

L'utilisateur a demandé des produits dans son système Odoo, mais aucun résultat n'a été trouvé pour sa recherche.

Informe-le poliment qu'aucun produit correspondant n'a été trouvé dans son système Odoo et suggère-lui de :
1. Vérifier l'orthographe de sa recherche
2. Essayer avec un autre terme
3. Vérifier que les produits sont bien enregistrés dans Odoo

Réponds en français de manière concise.`;
          }
        } else {
          const errorText = await mcpResponse.text();
          console.error('❌ Échec appel MCP:', mcpResponse.status, errorText);
        }
      } catch (mcpError) {
        console.error('❌ Erreur MCP:', mcpError);
      }
    }

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
${mcpContext}

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
