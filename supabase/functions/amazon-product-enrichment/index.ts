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
    const requestBody = await req.json();
    const { analysis_id, ean, asin, product_name } = requestBody;
    let productName = product_name;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[AMAZON-ENRICH] Starting enrichment:', { analysis_id, product_name: productName, ean, asin });

    let userId: string;
    let productEan: string | undefined = ean;
    let productAsin: string | undefined = asin;
    let analysisId = analysis_id;
    let currentAnalysis: any = null;

    // 1. Si analysis_id fourni, récupérer les infos
    if (analysis_id) {
      const { data: analysis, error: analysisError } = await supabase
        .from('product_analyses')
        .select('*, user_id')
        .eq('id', analysis_id)
        .single();

      if (analysisError || !analysis) {
        throw new Error('Product analysis not found');
      }

      currentAnalysis = analysis;
      userId = analysis.user_id;
      
      // Récupérer EAN/ASIN depuis l'analyse si pas fourni
      if (!productEan && !productAsin) {
        productEan = analysis.analysis_result?.barcode || 
                     analysis.analysis_result?.ean || 
                     analysis.analysis_result?.gtin;
        
        // Vérifier si product_url contient un EAN valide (13 chiffres)
        if (!productEan && analysis.product_url && /^\d{13}$/.test(analysis.product_url)) {
          console.log('[AMAZON-ENRICH] EAN found in product_url:', analysis.product_url);
          productEan = analysis.product_url;
        }
      }

      // Si pas d'EAN/ASIN, récupérer le nom du produit
      if (!productEan && !productAsin && !productName) {
        productName = analysis.analysis_result?.product_name;
      }

      console.log('[AMAZON-ENRICH] Identifiers extracted:', { 
        productEan, 
        productAsin, 
        product_name: productName 
      });

      // Mettre à jour le statut à "pending"
      await supabase
        .from('product_analyses')
        .update({ 
          amazon_enrichment_status: 'pending',
          amazon_last_attempt: new Date().toISOString()
        })
        .eq('id', analysis_id);
    } else {
      // Créer une nouvelle analyse si nécessaire
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      userId = user.id;

      // Créer l'analyse basique
      const { data: newAnalysis, error: createError } = await supabase
        .from('product_analyses')
        .insert({
          user_id: userId,
          product_url: productName || ean || asin || '',
          analysis_result: {
            product_name: productName,
            ean: ean,
            asin: asin
          },
          amazon_enrichment_status: 'pending',
          amazon_last_attempt: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !newAnalysis) {
        throw new Error('Failed to create analysis');
      }

      analysisId = newAnalysis.id;
    }

    // Vérifier qu'on a au moins un identifiant
    const hasIdentifier = productEan || productAsin || productName;
    if (!hasIdentifier) {
      console.error('[AMAZON-ENRICH] Missing identifiers:', {
        analysis_id: analysisId,
        productEan,
        productAsin,
        product_name: productName,
        product_url: currentAnalysis?.product_url,
        analysis_result_keys: Object.keys(currentAnalysis?.analysis_result || {})
      });
      
      await supabase
        .from('product_analyses')
        .update({ 
          amazon_enrichment_status: 'error',
          amazon_last_attempt: new Date().toISOString()
        })
        .eq('id', analysisId);
      
      return new Response(
        JSON.stringify({ 
          error: 'No identifier provided (EAN, ASIN, or product name)',
          details: { productEan, productAsin, product_name: productName }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[AMAZON-ENRICH] Identifiers:', { productEan, productAsin, product_name: productName });

    // 2. Obtenir le token Amazon valide
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('amazon-token-manager');
    
    if (tokenError) {
      console.error('[AMAZON-ENRICH] Token error:', tokenError);
      throw new Error(`Token error: ${tokenError.message}`);
    }

    const { access_token } = tokenData;
    console.log('[AMAZON-ENRICH] Token obtained');

    // 3. Récupérer le marketplace ID
    const { data: credentials } = await supabase
      .from('amazon_credentials')
      .select('marketplace_id')
      .eq('is_active', true)
      .maybeSingle();

    const marketplaceId = credentials?.marketplace_id || 'A13V1IB3VIYZZH';

    // 4. Appeler Amazon SP-API Catalog Items
    const catalogUrl = 'https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items';
    
    let amazonData;
    let searchMethod: string = 'UNKNOWN';

    // Essayer d'abord avec ASIN si fourni
    if (productAsin) {
      searchMethod = 'ASIN';
      const params = new URLSearchParams({
        identifiers: productAsin,
        identifiersType: 'ASIN',
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with ASIN...');
      const amazonResponse = await fetch(`${catalogUrl}?${params}`, {
        headers: {
          'x-amz-access-token': access_token,
          'Accept': 'application/json',
        },
      });

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      }
    }

    // Si pas de résultat avec ASIN, essayer avec EAN
    if (!amazonData?.items?.length && productEan) {
      searchMethod = 'EAN';
      const params = new URLSearchParams({
        identifiers: productEan,
        identifiersType: 'EAN',
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with EAN...');
      const amazonResponse = await fetch(`${catalogUrl}?${params}`, {
        headers: {
          'x-amz-access-token': access_token,
          'Accept': 'application/json',
        },
      });

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      }
    }

    // Si toujours pas de résultat, essayer avec le nom du produit (keywords)
    if (!amazonData?.items?.length && productName) {
      searchMethod = 'KEYWORDS';
      const params = new URLSearchParams({
        keywords: productName,
        marketplaceIds: marketplaceId,
        includedData: 'summaries,attributes,images,productTypes,salesRanks',
      });

      console.log('[AMAZON-ENRICH] Calling Amazon API with keywords...');
      const amazonResponse = await fetch(`${catalogUrl}?${params}`, {
        headers: {
          'x-amz-access-token': access_token,
          'Accept': 'application/json',
        },
      });

      if (amazonResponse.ok) {
        amazonData = await amazonResponse.json();
      }
    }

    console.log('[AMAZON-ENRICH] Data received:', amazonData?.items?.length || 0, 'items via', searchMethod);

    if (!amazonData?.items || amazonData.items.length === 0) {
      // Marquer comme "not_found"
      await supabase
        .from('product_analyses')
        .update({ amazon_enrichment_status: 'not_found' })
        .eq('id', analysisId);
      
      throw new Error('Product not found on Amazon');
    }

    // 5. Parser et formater les données
    const item = amazonData.items[0];
    const summaries = item.summaries?.[0] || {};
    const attributes = item.attributes || {};
    const images = item.images || [];
    const salesRanks = item.salesRanks || [];

    const formattedData = {
      analysis_id: analysisId,
      user_id: userId,
      asin: item.asin,
      ean: productEan || item.identifiers?.ean?.[0],
      title: summaries.itemName,
      brand: summaries.brand,
      manufacturer: summaries.manufacturer,
      product_type: summaries.productType,
      
      // Prix
      list_price: summaries.msrp?.amount,
      
      // Images
      images: images.map((img: any) => ({
        url: img.images?.[0]?.link,
        variant: img.variant,
        height: img.images?.[0]?.height,
        width: img.images?.[0]?.width,
      })),
      
      // Dimensions
      item_dimensions: attributes.item_dimensions?.[0],
      package_dimensions: attributes.package_dimensions?.[0],
      item_weight: attributes.item_weight?.[0]?.value,
      package_weight: attributes.package_weight?.[0]?.value,
      
      // Ventes
      sales_rank: salesRanks.map((rank: any) => ({
        category: rank.displayGroupTitle,
        rank: rank.rank,
      })),
      
      // Features
      features: attributes.bullet_point || [],
      color: attributes.color?.[0]?.value,
      size: attributes.size?.[0]?.value,
      
      // Données brutes
      raw_data: amazonData,
      last_synced_at: new Date().toISOString(),
    };

    console.log('[AMAZON-ENRICH] Formatted data ready, saving to database...');

    // 6. Upsert dans la base de données
    const { data: savedData, error: saveError } = await supabase
      .from('amazon_product_data')
      .upsert(formattedData, { onConflict: 'analysis_id' })
      .select()
      .single();

    if (saveError) {
      console.error('[AMAZON-ENRICH] Save error:', saveError);
      throw saveError;
    }

    console.log('[AMAZON-ENRICH] Data saved successfully');

    // Mettre à jour le statut à "success"
    await supabase
      .from('product_analyses')
      .update({ amazon_enrichment_status: 'success' })
      .eq('id', analysisId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: savedData,
        message: 'Amazon data synchronized successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AMAZON-ENRICH] Error:', error);
    
    // Marquer comme "error" ou "not_found" selon le type d'erreur
    const status = error.message?.includes('not found') ? 'not_found' : 'error';
    
    try {
      // Récupérer analysisId depuis les params de la requête
      const { analysis_id: errorAnalysisId } = await req.json().catch(() => ({}));
      
      // Tenter de mettre à jour le statut (si on a un analysisId)
      if (errorAnalysisId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey);
        
        await supabaseClient
          .from('product_analyses')
          .update({ amazon_enrichment_status: status })
          .eq('id', errorAnalysisId);
      }
    } catch (updateError) {
      console.error('[AMAZON-ENRICH] Failed to update status:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
