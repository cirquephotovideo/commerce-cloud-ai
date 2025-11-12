import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'GEMINI_API_KEY non configurée. Veuillez ajouter la clé API via Settings.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { question, forceSync = false } = await req.json();
    if (!question || typeof question !== 'string') {
      throw new Error('Question invalide');
    }

    console.log('[GEMINI-CHAT] User:', user.id, 'Question:', question);

    // 1. Check existing store
    const { data: existingStore } = await supabase
      .from('gemini_file_search_stores')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const lastSyncDate = existingStore?.last_sync_at ? new Date(existingStore.last_sync_at) : null;
    const needsSync = forceSync || 
      !existingStore || 
      !lastSyncDate ||
      (Date.now() - lastSyncDate.getTime() > 24 * 60 * 60 * 1000);

    let geminiStoreId = existingStore?.gemini_store_id;
    let productCount = existingStore?.product_count || 0;

    // 2. Sync products if needed
    if (needsSync) {
      console.log('[GEMINI-CHAT] Starting sync for user:', user.id);

      await supabase
        .from('gemini_file_search_stores')
        .upsert({
          user_id: user.id,
          store_name: `user-${user.id}-products`,
          gemini_store_id: geminiStoreId || 'pending',
          sync_status: 'syncing',
          last_sync_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      try {
        // Fetch all products with enrichments
        const { data: products, error: productsError } = await supabase
          .from('supplier_products')
          .select(`
            id, 
            product_name, 
            ean, 
            purchase_price,
            margin_percentage,
            stock_quantity,
            supplier_reference,
            product_links!inner(
              analysis:product_analyses(
                id,
                ean,
                analysis_result,
                specifications,
                long_description,
                cost_analysis,
                margin_percentage,
                amazon_product_data(
                  asin,
                  buy_box_price,
                  lowest_new_price,
                  offer_count_new
                )
              )
            )
          `)
          .eq('user_id', user.id);

        if (productsError) throw productsError;
        if (!products || products.length === 0) {
          throw new Error('Aucun produit trouvé pour cet utilisateur');
        }

        console.log('[GEMINI-CHAT] Found products:', products.length);

        // Create or get Gemini File Search Store
        if (!geminiStoreId) {
          const createStoreRes = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/corpora',
            {
              method: 'POST',
              headers: {
                'X-Goog-Api-Key': GEMINI_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                displayName: `user-${user.id}-products`,
              }),
            }
          );

          if (!createStoreRes.ok) {
            const errorText = await createStoreRes.text();
            throw new Error(`Failed to create Gemini store: ${errorText}`);
          }

          const storeData = await createStoreRes.json();
          geminiStoreId = storeData.name;
          console.log('[GEMINI-CHAT] Created store:', geminiStoreId);
        }

        // Upload products as documents
        let uploadedCount = 0;
        for (const product of products.slice(0, 100)) { // Limit to 100 for initial version
          const analysis = product.product_links?.[0]?.analysis;
          
          const documentContent = {
            product_id: product.id,
            name: product.product_name,
            ean: product.ean,
            supplier_reference: product.supplier_reference,
            purchase_price: product.purchase_price,
            margin: product.margin_percentage,
            stock: product.stock_quantity,
            brand: analysis?.analysis_result?.brand,
            category: analysis?.analysis_result?.category,
            description: analysis?.analysis_result?.description?.suggested_description || analysis?.analysis_result?.description,
            specifications: analysis?.specifications,
            long_description: analysis?.long_description,
            amazon_asin: analysis?.amazon_product_data?.[0]?.asin,
            amazon_price: analysis?.amazon_product_data?.[0]?.buy_box_price,
            cost_analysis: analysis?.cost_analysis,
          };

          const createDocRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${geminiStoreId}/documents`,
            {
              method: 'POST',
              headers: {
                'X-Goog-Api-Key': GEMINI_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                displayName: `product-${product.id}`,
                mimeType: 'text/plain',
                text: JSON.stringify(documentContent, null, 2),
              }),
            }
          );

          if (createDocRes.ok) {
            uploadedCount++;
          } else {
            console.error('[GEMINI-CHAT] Failed to upload product:', product.id);
          }
        }

        productCount = uploadedCount;
        console.log('[GEMINI-CHAT] Uploaded documents:', uploadedCount);

        // Update sync status
        await supabase
          .from('gemini_file_search_stores')
          .upsert({
            user_id: user.id,
            store_name: `user-${user.id}-products`,
            gemini_store_id: geminiStoreId,
            sync_status: 'completed',
            product_count: productCount,
            last_sync_at: new Date().toISOString(),
            error_message: null
          }, { onConflict: 'user_id' });

      } catch (syncError) {
        console.error('[GEMINI-CHAT] Sync error:', syncError);
        
        await supabase
          .from('gemini_file_search_stores')
          .upsert({
            user_id: user.id,
            store_name: `user-${user.id}-products`,
            gemini_store_id: geminiStoreId || 'error',
            sync_status: 'failed',
            error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
            last_sync_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        throw syncError;
      }
    }

    // 3. Execute RAG query
    console.log('[GEMINI-CHAT] Executing RAG query with store:', geminiStoreId);

    const ragResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Tu es un assistant e-commerce expert. Réponds en français de manière précise et professionnelle.

Question: ${question}

Instructions:
- Utilise les données de produits du corpus pour répondre
- Cite les produits spécifiques quand c'est pertinent
- Donne des recommandations actionnables et concrètes
- Si tu mentionnes un produit, indique son EAN et son product_id entre crochets [product_id: xxx]
- Formate ta réponse de manière structurée avec des listes à puces si nécessaire`
            }]
          }],
          tools: [{
            googleSearch: {}
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const ragData = await ragResponse.json();
    const answer = ragData.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu générer une réponse.';

    // 4. Extract referenced product IDs
    const productIdMatches = answer.match(/\[product_id:\s*([a-f0-9-]+)\]/gi) || [];
    const productIds = productIdMatches.map((match: string) => {
      const idMatch = match.match(/([a-f0-9-]+)/);
      return idMatch ? idMatch[1] : null;
    }).filter(Boolean);

    console.log('[GEMINI-CHAT] Response generated, referenced products:', productIds.length);

    return new Response(
      JSON.stringify({
        success: true,
        answer: answer,
        referencedProductIds: productIds,
        storeInfo: {
          productCount: productCount,
          lastSyncAt: existingStore?.last_sync_at || new Date().toISOString(),
          syncStatus: existingStore?.sync_status || 'completed'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GEMINI-CHAT] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
