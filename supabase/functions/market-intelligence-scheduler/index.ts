import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');

interface MarketData {
  productName: string;
  productEan?: string;
  amazonPrice?: number;
  googleShoppingMinPrice?: number;
  googleShoppingMaxPrice?: number;
  googleShoppingAvgPrice?: number;
  currentUserPrice?: number;
  competitorsCount: number;
  marketPosition: string;
  aiRecommendation: string;
  aiConfidenceScore: number;
  aiReasoning: string;
  searchVolumeTrend: string;
  marketDemand: string;
  alertType?: string;
  alertSeverity: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log(`[MARKET-INTELLIGENCE] Starting analysis for user ${user.id}`);

    // Récupérer les 20 produits les plus récents de l'utilisateur
    const { data: products, error: productsError } = await supabase
      .from('supplier_products')
      .select('id, product_name, ean, purchase_price')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (productsError) {
      console.error('[MARKET-INTELLIGENCE] Error fetching products:', productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No products to analyze',
          analyzed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MARKET-INTELLIGENCE] Analyzing ${products.length} products`);

    const marketDataResults: MarketData[] = [];

    // Analyser chaque produit
    for (const product of products) {
      try {
        console.log(`[MARKET-INTELLIGENCE] Analyzing: ${product.product_name}`);

        // 1. Recherche Google Shopping via Serper API
        let googleShoppingData = null;
        if (SERPER_API_KEY) {
          try {
            const serperResponse = await fetch('https://google.serper.dev/shopping', {
              method: 'POST',
              headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                q: product.ean || product.product_name,
                gl: 'fr',
                hl: 'fr',
                num: 10
              })
            });

            if (serperResponse.ok) {
              googleShoppingData = await serperResponse.json();
              console.log(`[MARKET-INTELLIGENCE] Google Shopping data found for ${product.product_name}`);
            }
          } catch (error) {
            console.error(`[MARKET-INTELLIGENCE] Serper API error:`, error);
          }
        }

        // Extraire les prix de Google Shopping
        let prices: number[] = [];
        if (googleShoppingData?.shopping) {
          prices = googleShoppingData.shopping
            .map((item: any) => {
              const priceStr = item.price?.replace(/[^\d.,]/g, '').replace(',', '.');
              return parseFloat(priceStr);
            })
            .filter((price: number) => !isNaN(price) && price > 0);
        }

        const googleShoppingMinPrice = prices.length > 0 ? Math.min(...prices) : null;
        const googleShoppingMaxPrice = prices.length > 0 ? Math.max(...prices) : null;
        const googleShoppingAvgPrice = prices.length > 0 
          ? prices.reduce((a, b) => a + b, 0) / prices.length 
          : null;

        // 2. Analyse IA pour recommandations
        const aiAnalysis = await analyzeWithAI(
          product.product_name,
          product.purchase_price,
          googleShoppingAvgPrice,
          googleShoppingMinPrice,
          prices.length
        );

        const marketData: MarketData = {
          productName: product.product_name,
          productEan: product.ean,
          amazonPrice: null, // À implémenter avec Amazon MCP
          googleShoppingMinPrice,
          googleShoppingMaxPrice,
          googleShoppingAvgPrice,
          currentUserPrice: product.purchase_price,
          competitorsCount: prices.length,
          marketPosition: aiAnalysis.marketPosition,
          aiRecommendation: aiAnalysis.recommendation,
          aiConfidenceScore: aiAnalysis.confidence,
          aiReasoning: aiAnalysis.reasoning,
          searchVolumeTrend: 'stable',
          marketDemand: aiAnalysis.marketDemand,
          alertType: aiAnalysis.alertType,
          alertSeverity: aiAnalysis.alertSeverity
        };

        marketDataResults.push(marketData);

        // Sauvegarder dans la DB
        const { error: insertError } = await supabase
          .from('market_intelligence_data')
          .insert({
            user_id: user.id,
            product_name: marketData.productName,
            product_ean: marketData.productEan,
            amazon_price: marketData.amazonPrice,
            google_shopping_min_price: marketData.googleShoppingMinPrice,
            google_shopping_max_price: marketData.googleShoppingMaxPrice,
            google_shopping_avg_price: marketData.googleShoppingAvgPrice,
            current_user_price: marketData.currentUserPrice,
            competitors_count: marketData.competitorsCount,
            market_position: marketData.marketPosition,
            ai_recommendation: marketData.aiRecommendation,
            ai_confidence_score: marketData.aiConfidenceScore,
            ai_reasoning: marketData.aiReasoning,
            search_volume_trend: marketData.searchVolumeTrend,
            market_demand: marketData.marketDemand,
            alert_type: marketData.alertType,
            alert_severity: marketData.alertSeverity
          });

        if (insertError) {
          console.error(`[MARKET-INTELLIGENCE] Error inserting data:`, insertError);
        }

      } catch (error) {
        console.error(`[MARKET-INTELLIGENCE] Error analyzing product ${product.product_name}:`, error);
      }
    }

    console.log(`[MARKET-INTELLIGENCE] Analysis complete. Analyzed ${marketDataResults.length} products`);

    return new Response(
      JSON.stringify({ 
        success: true,
        analyzed: marketDataResults.length,
        results: marketDataResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MARKET-INTELLIGENCE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function analyzeWithAI(
  productName: string,
  userPrice: number | null,
  avgMarketPrice: number | null,
  minMarketPrice: number | null,
  competitorCount: number
): Promise<{
  recommendation: string;
  confidence: number;
  reasoning: string;
  marketPosition: string;
  marketDemand: string;
  alertType: string | null;
  alertSeverity: string;
}> {
  // Analyse simple basée sur les données disponibles
  let recommendation = 'maintain';
  let confidence = 0.7;
  let reasoning = 'Données insuffisantes pour une recommandation précise';
  let marketPosition = 'unknown';
  let marketDemand = 'medium';
  let alertType: string | null = null;
  let alertSeverity = 'info';

  if (userPrice && avgMarketPrice) {
    const priceDiff = ((userPrice - avgMarketPrice) / avgMarketPrice) * 100;

    if (priceDiff > 20) {
      recommendation = 'lower_price';
      confidence = 0.85;
      reasoning = `Votre prix est ${priceDiff.toFixed(0)}% plus élevé que la moyenne du marché. Risque de perte de compétitivité.`;
      marketPosition = 'expensive';
      alertType = 'threat';
      alertSeverity = 'warning';
    } else if (priceDiff > 10) {
      recommendation = 'review';
      confidence = 0.75;
      reasoning = `Votre prix est ${priceDiff.toFixed(0)}% au-dessus de la moyenne. À surveiller.`;
      marketPosition = 'above_average';
      alertType = 'competitor_cheaper';
      alertSeverity = 'info';
    } else if (priceDiff < -10) {
      recommendation = 'increase_price';
      confidence = 0.8;
      reasoning = `Votre prix est ${Math.abs(priceDiff).toFixed(0)}% en dessous de la moyenne. Opportunité d'améliorer les marges.`;
      marketPosition = 'cheapest';
      alertType = 'opportunity';
      alertSeverity = 'info';
    } else {
      recommendation = 'maintain';
      confidence = 0.9;
      reasoning = `Votre prix est aligné avec le marché (${priceDiff.toFixed(0)}% de différence).`;
      marketPosition = 'average';
    }

    if (competitorCount > 5) {
      marketDemand = 'high';
      confidence += 0.05;
    } else if (competitorCount < 3) {
      marketDemand = 'low';
    }
  }

  return {
    recommendation,
    confidence: Math.min(confidence, 1),
    reasoning,
    marketPosition,
    marketDemand,
    alertType,
    alertSeverity
  };
}