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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting automated market intelligence check...');

    // Récupérer toutes les surveillances actives
    const { data: activeMonitorings, error: monitoringError } = await supabaseClient
      .from('price_monitoring')
      .select('*')
      .eq('is_active', true);

    if (monitoringError) {
      throw monitoringError;
    }

    console.log(`Found ${activeMonitorings?.length || 0} active price monitorings`);

    const results = [];

    for (const monitoring of activeMonitorings || []) {
      try {
        console.log(`Checking prices for: ${monitoring.product_name}`);

        // Rechercher le produit
        const searchResult = await supabaseClient.functions.invoke('google-shopping-scraper', {
          body: { productName: monitoring.product_name }
        });

        if (searchResult.error) {
          console.error(`Error searching for ${monitoring.product_name}:`, searchResult.error);
          continue;
        }

        const { results: offers = [], statistics } = searchResult.data || {};
        
        console.log(`Found ${offers.length} offers for ${monitoring.product_name}`);

        // Trouver le meilleur prix
        let bestPrice = Infinity;
        let bestOffer = null;

        for (const offer of offers) {
          if (offer.price?.value && offer.price.value < bestPrice) {
            bestPrice = offer.price.value;
            bestOffer = offer;
          }
        }

        // Mettre à jour la surveillance
        await supabaseClient
          .from('price_monitoring')
          .update({
            current_price: bestPrice === Infinity ? null : bestPrice,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', monitoring.id);

        // Créer des alertes si nécessaire
        if (bestPrice !== Infinity && monitoring.target_price) {
          const priceDiff = ((monitoring.target_price - bestPrice) / monitoring.target_price) * 100;

          // Alerte si le prix est inférieur au prix cible
          if (bestPrice < monitoring.target_price) {
            await supabaseClient.from('user_alerts').insert({
              user_id: monitoring.user_id,
              alert_type: 'price_opportunity',
              priority: 'high',
              alert_data: {
                product_name: monitoring.product_name,
                monitoring_id: monitoring.id,
                target_price: monitoring.target_price,
                current_price: bestPrice,
                savings_percent: priceDiff.toFixed(1),
                merchant: bestOffer?.merchant,
                url: bestOffer?.link,
              }
            });

            console.log(`Created price opportunity alert for ${monitoring.product_name}`);
          }

          // Alerte si changement de prix significatif
          if (monitoring.current_price && Math.abs(((bestPrice - monitoring.current_price) / monitoring.current_price) * 100) >= monitoring.alert_threshold_percentage) {
            await supabaseClient.from('user_alerts').insert({
              user_id: monitoring.user_id,
              alert_type: 'price_change',
              priority: bestPrice < monitoring.current_price ? 'medium' : 'low',
              alert_data: {
                product_name: monitoring.product_name,
                monitoring_id: monitoring.id,
                old_price: monitoring.current_price,
                new_price: bestPrice,
                change_percent: ((bestPrice - monitoring.current_price) / monitoring.current_price * 100).toFixed(1),
              }
            });

            console.log(`Created price change alert for ${monitoring.product_name}`);
          }
        }

        // Sauvegarder dans l'historique
        if (bestPrice !== Infinity) {
          await supabaseClient.from('price_history').insert({
            price_monitoring_id: monitoring.id,
            user_id: monitoring.user_id,
            price: bestPrice,
            stock_status: bestOffer?.availability || 'unknown',
            source: monitoring.search_engine,
          });
        }

        results.push({
          product: monitoring.product_name,
          success: true,
          offersFound: offers.length,
          bestPrice: bestPrice === Infinity ? null : bestPrice,
        });

      } catch (error) {
        console.error(`Error processing ${monitoring.product_name}:`, error);
        results.push({
          product: monitoring.product_name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: results.length,
        results,
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