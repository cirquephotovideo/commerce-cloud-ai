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

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('❌ Erreur authentification:', userError);
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Utilisateur authentifié:', user.id);

    let systemPrompt = `Tu es un assistant IA expert en e-commerce et gestion de catalogue.

Tu peux aider avec :
- Des recommandations de produits
- Des analyses de prix et marges
- Des optimisations de catalogue
- Des conseils sur les fournisseurs
- Des stratégies de tarification

Réponds de manière concise, professionnelle et orientée résultats. Utilise des emojis pour rendre la conversation agréable 😊`;

    // Si productId fourni, récupérer les détails du produit
    if (productId) {
      const { data: product, error: productError } = await supabaseClient
        .from('product_analyses')
        .select(`
          *,
          supplier_products(
            id,
            supplier_id,
            purchase_price,
            supplier_configurations(name)
          ),
          amazon_product_data(*)
        `)
        .eq('id', productId)
        .eq('user_id', user.id)
        .single();

      if (productError) {
        console.error('❌ Erreur récupération produit:', productError);
        return new Response(
          JSON.stringify({ error: 'Produit non trouvé' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (product) {
        console.log('✅ Produit récupéré:', { 
          id: product.id, 
          name: product.product_name || product.name,
          hasSuppliers: product.supplier_products?.length > 0,
          hasAmazonData: !!product.amazon_product_data?.[0]
        });
        const analysisResult = product.analysis_result || {};
        const amazonData = product.amazon_product_data?.[0] || null;
        
        systemPrompt = `Tu es un assistant IA expert en e-commerce spécialisé dans l'analyse de produits.

CONTEXTE DU PRODUIT :
- Nom : ${product.product_name || product.name || 'Non spécifié'}
- EAN : ${product.ean || 'Non disponible'}
- Prix d'achat : ${product.purchase_price ? `${product.purchase_price}€` : 'Non disponible'}
- Prix de vente recommandé : ${analysisResult.price ? `${analysisResult.price}€` : 'Non disponible'}
- Catégorie : ${analysisResult.category || 'Non spécifiée'}
- Marque : ${analysisResult.brand || 'Non spécifiée'}
- Description : ${analysisResult.description || analysisResult.description_short || 'Non disponible'}

${product.supplier_products?.length > 0 ? `FOURNISSEURS :
${product.supplier_products.map((sp: any) => 
  `- ${sp.supplier_configurations?.name || 'Inconnu'}: ${sp.purchase_price}€`
).join('\n')}` : 'Aucun fournisseur lié'}

${amazonData ? `DONNÉES AMAZON :
- Prix Amazon : ${amazonData.buy_box_price ? `${amazonData.buy_box_price}€` : 'Non disponible'}
- Nombre d'offres : ${amazonData.offer_count_new || 0}
- Note moyenne : ${amazonData.raw_data?.rating || 'Non disponible'}
- Rang de ventes : ${amazonData.sales_rank ? JSON.stringify(amazonData.sales_rank) : 'Non disponible'}` : ''}

RÈGLES :
1. Réponds uniquement aux questions sur CE produit
2. Sois concis et précis (max 200 mots)
3. Si le prix est demandé, donne à la fois le prix d'achat et de vente
4. Compare avec les données Amazon si disponibles
5. Recommande des actions concrètes (ajuster prix, changer fournisseur, enrichir données)
6. Utilise des emojis pour rendre la conversation agréable 😊
7. Structure ta réponse avec des bullet points si nécessaire

FORMAT DE RÉPONSE :
- Court et direct
- Orienté action business
- Basé uniquement sur les données fournies`;
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
