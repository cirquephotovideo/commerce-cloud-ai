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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    const { analysisId, productName } = await req.json();

    console.log(`Auto-surveillance pour ${productName} (analysis: ${analysisId})`);

    // Appeler google-shopping-scraper pour rechercher le produit
    const searchResult = await supabaseClient.functions.invoke('google-shopping-scraper', {
      body: { productName }
    });

    if (searchResult.error) {
      throw searchResult.error;
    }

    const { results = [], statistics } = searchResult.data || {};
    
    console.log(`Trouvé ${results.length} offres pour ${productName}`);

    // Analyser les résultats et créer des alertes
    const alerts = [];
    let bestDeal = null;
    let minPrice = Infinity;

    for (const result of results) {
      if (result.price?.value && result.price.value < minPrice) {
        minPrice = result.price.value;
        bestDeal = result;
      }
    }

    // Créer une alerte si une bonne affaire est détectée (> 10% d'économie)
    if (bestDeal && statistics?.average_price) {
      const savings = ((statistics.average_price - minPrice) / statistics.average_price) * 100;
      
      if (savings > 10) {
        await supabaseClient.from('user_alerts').insert({
          user_id: user.id,
          alert_type: 'price_opportunity',
          priority: 'high',
          alert_data: {
            product_name: productName,
            analysis_id: analysisId,
            best_price: minPrice,
            average_price: statistics.average_price,
            savings_percent: savings.toFixed(1),
            merchant: bestDeal.merchant,
            url: bestDeal.link
          }
        });

        alerts.push({
          type: 'price_opportunity',
          message: `Économie de ${savings.toFixed(1)}% détectée pour ${productName}`
        });
      }
    }

    // Créer une alerte si nouveau concurrent détecté
    const uniqueMerchants = new Set(results.map((r: any) => r.merchant).filter(Boolean));
    if (uniqueMerchants.size > 5) {
      alerts.push({
        type: 'new_competitors',
        message: `${uniqueMerchants.size} marchands trouvés pour ${productName}`
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        offersFound: results.length,
        bestDeal,
        alerts,
        statistics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur auto-market-intelligence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});