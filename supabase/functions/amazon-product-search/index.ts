import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchType, identifier, format = 'raw' } = await req.json();

    console.log('[AMAZON-SEARCH] Request:', { searchType, identifier, format });

    // Get Amazon access token
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('amazon-token-manager');
    
    if (tokenError || !tokenData?.access_token) {
      throw new Error('Failed to get Amazon access token');
    }

    // Determine identifierType for Amazon API
    let identifierType = 'ASIN';
    if (searchType === 'ean') identifierType = 'EAN';
    else if (searchType === 'name') identifierType = 'GTIN'; // Amazon uses GTIN for keyword search

    // Build Amazon SP-API URL
    const marketplaceId = 'A13V1IB3VIYZZH'; // France
    const includedData = 'summaries,attributes,images,productTypes,salesRanks';
    
    let amazonUrl = `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items`;
    
    if (searchType === 'name') {
      // Search by keywords
      amazonUrl += `?keywords=${encodeURIComponent(identifier)}&marketplaceIds=${marketplaceId}&includedData=${includedData}`;
    } else {
      // Search by identifier (ASIN or EAN)
      amazonUrl += `?identifiers=${encodeURIComponent(identifier)}&identifiersType=${identifierType}&marketplaceIds=${marketplaceId}&includedData=${includedData}`;
    }

    console.log('[AMAZON-SEARCH] Calling Amazon API:', amazonUrl);

    // Call Amazon SP-API
    const amazonResponse = await fetch(amazonUrl, {
      headers: {
        'x-amz-access-token': tokenData.access_token,
        'Accept': 'application/json',
      },
    });

    if (!amazonResponse.ok) {
      const error = await amazonResponse.text();
      console.error('[AMAZON-SEARCH] Amazon API error:', amazonResponse.status, error);
      throw new Error(`Amazon API error: ${amazonResponse.status}`);
    }

    const amazonData = await amazonResponse.json();
    
    if (!amazonData.items || amazonData.items.length === 0) {
      return new Response(JSON.stringify({ error: 'No product found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const item = amazonData.items[0];

    // Return raw format
    if (format === 'raw') {
      return new Response(JSON.stringify({ data: amazonData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform to catalog format
    if (format === 'catalog') {
      const catalogData = {
        asin: item.asin,
        ean: item.identifiers?.ean?.[0] || null,
        upc: item.identifiers?.upc?.[0] || null,
        name: item.summaries?.[0]?.itemName || 'N/A',
        brand: item.attributes?.brand?.[0]?.value || item.summaries?.[0]?.brand || 'N/A',
        price: item.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.amount || 0,
        currency: item.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.currencyCode || 'EUR',
        images: item.images?.map((img: any) => img.link) || [],
        categories: item.productTypes || [],
        weight: item.attributes?.item_weight?.[0]?.value || null,
        dimensions: item.attributes?.item_dimensions?.[0]?.value || null,
        salesRank: item.salesRanks?.[0]?.rank || null,
      };

      return new Response(JSON.stringify({ data: catalogData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform to enriched format using AI
    if (format === 'enriched') {
      const prompt = `Analyse ce produit Amazon et génère une version enrichie avec:
- Titre optimisé SEO (maximum 60 caractères, incluant mots-clés importants)
- Description courte marketing (150 caractères, accrocheur)
- Description longue détaillée (500+ caractères, avec caractéristiques, avantages, cas d'usage)
- 10 mots-clés pertinents
- 5 caractéristiques principales
- Taxonomie Google Shopping et Amazon suggérées

Produit brut:
${JSON.stringify({
  name: item.summaries?.[0]?.itemName,
  brand: item.attributes?.brand?.[0]?.value,
  features: item.attributes?.bullet_point?.map((bp: any) => bp.value) || [],
  categories: item.productTypes || [],
}, null, 2)}

Réponds en JSON avec cette structure:
{
  "title": "...",
  "description_short": "...",
  "description_long": "...",
  "keywords": ["...", ...],
  "features": ["...", ...],
  "taxonomy": {
    "google": "Catégorie > Sous-catégorie",
    "amazon": "Browse Node Path"
  }
}`;

      console.log('[AMAZON-SEARCH] Calling AI for enrichment');

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: { message: prompt }
      });

      if (aiError) {
        console.error('[AMAZON-SEARCH] AI enrichment error:', aiError);
        throw new Error('Failed to enrich product data');
      }

      // Parse AI response
      let enrichedData;
      try {
        // Extract JSON from AI response
        const jsonMatch = aiResponse.response?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          enrichedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        console.error('[AMAZON-SEARCH] Failed to parse AI response:', parseError);
        // Fallback to basic enriched format
        enrichedData = {
          title: item.summaries?.[0]?.itemName || 'N/A',
          description_short: `${item.attributes?.brand?.[0]?.value || 'Produit'} de qualité`,
          description_long: item.attributes?.bullet_point?.map((bp: any) => bp.value).join(' ') || 'Description non disponible',
          keywords: item.productTypes || [],
          features: item.attributes?.bullet_point?.map((bp: any) => bp.value) || [],
          taxonomy: {
            google: item.productTypes?.[0] || 'N/A',
            amazon: item.browseNodeInfo?.[0]?.displayName || 'N/A'
          }
        };
      }

      return new Response(JSON.stringify({ 
        data: {
          ...enrichedData,
          original: {
            asin: item.asin,
            ean: item.identifiers?.ean?.[0],
            price: item.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.amount,
            currency: item.summaries?.[0]?.buyBoxPrices?.[0]?.listingPrice?.currencyCode,
            images: item.images?.map((img: any) => img.link) || []
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid format specified');

  } catch (error) {
    console.error('[AMAZON-SEARCH] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
