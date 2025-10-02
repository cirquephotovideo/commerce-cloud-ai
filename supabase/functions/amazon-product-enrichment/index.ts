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
    const { analysis_id } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[AMAZON-ENRICH] Starting enrichment for analysis:', analysis_id);

    // 1. Récupérer l'analyse produit
    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('*, user_id')
      .eq('id', analysis_id)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Product analysis not found');
    }

    const userId = analysis.user_id;
    const ean = analysis.analysis_result?.barcode || 
                analysis.analysis_result?.ean || 
                analysis.analysis_result?.gtin;

    if (!ean) {
      throw new Error('No EAN/barcode found in product analysis');
    }

    console.log('[AMAZON-ENRICH] EAN found:', ean);

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
    const params = new URLSearchParams({
      identifiers: ean,
      identifiersType: 'EAN',
      marketplaceIds: marketplaceId,
      includedData: 'summaries,attributes,images,productTypes,salesRanks',
    });

    console.log('[AMAZON-ENRICH] Calling Amazon API...');
    const amazonResponse = await fetch(`${catalogUrl}?${params}`, {
      headers: {
        'x-amz-access-token': access_token,
        'Accept': 'application/json',
      },
    });

    if (!amazonResponse.ok) {
      const errorText = await amazonResponse.text();
      console.error('[AMAZON-ENRICH] API error:', errorText);
      throw new Error(`Amazon API error: ${amazonResponse.status} - ${errorText}`);
    }

    const amazonData = await amazonResponse.json();
    console.log('[AMAZON-ENRICH] Data received:', amazonData.items?.length || 0, 'items');

    if (!amazonData.items || amazonData.items.length === 0) {
      throw new Error('Product not found on Amazon');
    }

    // 5. Parser et formater les données
    const item = amazonData.items[0];
    const summaries = item.summaries?.[0] || {};
    const attributes = item.attributes || {};
    const images = item.images || [];
    const salesRanks = item.salesRanks || [];

    const formattedData = {
      analysis_id,
      user_id: userId,
      asin: item.asin,
      ean: ean,
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
