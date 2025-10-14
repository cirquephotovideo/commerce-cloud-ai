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
    console.log('📦 [BUILD-CONTEXT] Function started');

    const authHeader = req.headers.get('Authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return new Response(
        JSON.stringify({ error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const accessToken = tokenMatch[1];

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      }
    );

    const { productId } = await req.json();
    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'productId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 [BUILD-CONTEXT] Building context for product:', productId);

    // Get user from token to have user_id for RLS
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken);
    if (userError || !user) {
      console.error('❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch product data with joins
    const { data: product, error: productError } = await supabaseClient
      .from('product_analyses')
      .select(`
        *,
        supplier_products!inner(id, supplier_id, purchase_price, stock_quantity, supplier_reference),
        amazon_product_data(*)
      `)
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('❌ Product not found:', productError);
      return new Response(
        JSON.stringify({ error: 'Produit introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build consolidated context text
    const contextParts: string[] = [];
    
    // Identity section
    contextParts.push('=== IDENTITÉ DU PRODUIT ===');
    contextParts.push(`EAN: ${product.ean || 'N/A'}`);
    contextParts.push(`Nom: ${product.product_name || product.name || 'N/A'}`);
    if (product.analysis_result?.brand) {
      contextParts.push(`Marque: ${product.analysis_result.brand}`);
    }
    if (product.analysis_result?.category) {
      contextParts.push(`Catégorie: ${product.analysis_result.category}`);
    }
    contextParts.push('');

    // Pricing section
    contextParts.push('=== PRIX ===');
    if (product.purchase_price) {
      contextParts.push(`Prix d'achat: ${product.purchase_price}€`);
    }
    if (product.analysis_result?.price || product.analysis_result?.selling_price) {
      const sellingPrice = product.analysis_result.price || product.analysis_result.selling_price;
      contextParts.push(`Prix de vente conseillé: ${sellingPrice}€`);
    }
    if (product.margin_percentage) {
      contextParts.push(`Marge: ${product.margin_percentage}%`);
    }
    contextParts.push('');

    // Suppliers section
    if (product.supplier_products && Array.isArray(product.supplier_products) && product.supplier_products.length > 0) {
      contextParts.push('=== FOURNISSEURS ===');
      product.supplier_products.forEach((sp: any, idx: number) => {
        contextParts.push(`Fournisseur ${idx + 1}:`);
        if (sp.supplier_id) contextParts.push(`  - ID: ${sp.supplier_id}`);
        if (sp.purchase_price) contextParts.push(`  - Prix: ${sp.purchase_price}€`);
        if (sp.stock_quantity !== null && sp.stock_quantity !== undefined) {
          contextParts.push(`  - Stock: ${sp.stock_quantity}`);
        }
        if (sp.supplier_reference) contextParts.push(`  - Référence: ${sp.supplier_reference}`);
      });
      contextParts.push('');
    }

    // Amazon section
    if (product.amazon_product_data && Array.isArray(product.amazon_product_data) && product.amazon_product_data.length > 0) {
      const amazonData = product.amazon_product_data[0];
      contextParts.push('=== DONNÉES AMAZON ===');
      if (amazonData.asin) contextParts.push(`ASIN: ${amazonData.asin}`);
      if (amazonData.buy_box_price) contextParts.push(`Prix Buy Box: ${amazonData.buy_box_price}€`);
      if (amazonData.lowest_new_price) contextParts.push(`Prix le plus bas (neuf): ${amazonData.lowest_new_price}€`);
      if (amazonData.offer_count_new) contextParts.push(`Nombre d'offres neuves: ${amazonData.offer_count_new}`);
      contextParts.push('');
    }

    // Key points from analysis
    if (product.analysis_result) {
      contextParts.push('=== POINTS CLÉS ===');
      if (product.analysis_result.description) {
        contextParts.push(`Description: ${product.analysis_result.description.substring(0, 300)}...`);
      }
      if (product.analysis_result.key_features && Array.isArray(product.analysis_result.key_features)) {
        contextParts.push('Caractéristiques principales:');
        product.analysis_result.key_features.slice(0, 5).forEach((feat: string) => {
          contextParts.push(`  - ${feat}`);
        });
      }
      contextParts.push('');
    }

    const contextText = contextParts.join('\n');

    // Upsert into product_chat_contexts
    const { error: upsertError } = await supabaseClient
      .from('product_chat_contexts')
      .upsert({
        user_id: user.id,
        product_id: productId,
        context_text: contextText,
        status: 'ready',
        last_built_at: new Date().toISOString(),
        version: 1,
      }, {
        onConflict: 'user_id,product_id'
      });

    if (upsertError) {
      console.error('❌ Failed to upsert context:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la sauvegarde du contexte', details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [BUILD-CONTEXT] Context built successfully for product:', productId);
    return new Response(
      JSON.stringify({ success: true, productId, contextLength: contextText.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [BUILD-CONTEXT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
