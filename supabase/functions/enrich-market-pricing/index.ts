import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOllamaWithWebSearch } from "../_shared/ollama-client.ts";

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { variant_id, batch_mode = false, analysis_id } = await req.json();

    // Si batch_mode, enrichir tous les variants d'une analyse
    let variantsToEnrich = [];
    if (batch_mode && analysis_id) {
      const { data: variants } = await supabaseClient
        .from('supplier_price_variants')
        .select('*')
        .eq('analysis_id', analysis_id)
        .eq('user_id', user.id);
      variantsToEnrich = variants || [];
    } else if (variant_id) {
      const { data: variant } = await supabaseClient
        .from('supplier_price_variants')
        .select('*')
        .eq('id', variant_id)
        .eq('user_id', user.id)
        .single();
      variantsToEnrich = variant ? [variant] : [];
    }

    if (variantsToEnrich.length === 0) {
      throw new Error('No variants found to enrich');
    }

    const results = [];

    for (const variant of variantsToEnrich) {
      // Marquer comme en cours
      await supabaseClient
        .from('supplier_price_variants')
        .update({ enrichment_status: 'enriching' })
        .eq('id', variant.id);

      try {
        // Récupérer les infos produit
        const { data: analysis } = await supabaseClient
          .from('product_analyses')
          .select('name, ean, brand, analysis_result')
          .eq('id', variant.analysis_id)
          .single();

        // Construire le prompt pour Ollama web search
        const searchQuery = `Prix marché actuel pour: ${analysis?.name || 'produit'} ${analysis?.brand ? 'marque ' + analysis.brand : ''} ${analysis?.ean ? 'EAN ' + analysis.ean : ''}. Rechercher prix de vente TTC moyens sur sites e-commerce français (Amazon, Fnac, Cdiscount, etc.)`;

        console.log(`[MARKET PRICING] Recherche pour variant ${variant.id}: ${searchQuery}`);

        // Appeler Ollama avec web search
        const aiResponse = await callOllamaWithWebSearch({
          model: 'qwen3-coder:480b-cloud',
          messages: [
            {
              role: 'user',
              content: `${searchQuery}

Retourne UNIQUEMENT un objet JSON avec cette structure exacte:
{
  "market_price": <prix moyen trouvé en euros, nombre décimal>,
  "price_range": "<fourchette prix type: 45-55€>",
  "sources": "<liste des sites consultés>",
  "confidence": "<high/medium/low>",
  "notes": "<observations sur les prix trouvés>"
}

Si aucun prix n'est trouvé, retourne market_price: null.`
            }
          ],
          temperature: 0.3,
          maxTokens: 1000
        });

        console.log(`[MARKET PRICING] Réponse Ollama:`, aiResponse.content);

        // Parser la réponse JSON
        let marketData;
        try {
          const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            marketData = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Erreur parsing JSON:', e);
          marketData = { market_price: null };
        }

        if (marketData.market_price) {
          // Calculer la marge suggérée (30% par défaut)
          const purchasePrice = variant.purchase_price || 0;
          const suggestedMargin = 30; // 30%
          const suggestedSellingPrice = purchasePrice * (1 + suggestedMargin / 100);

          // Déterminer la compétitivité
          let competitiveness = 'average';
          if (suggestedSellingPrice < marketData.market_price * 0.9) {
            competitiveness = 'excellent';
          } else if (suggestedSellingPrice < marketData.market_price * 0.95) {
            competitiveness = 'good';
          } else if (suggestedSellingPrice > marketData.market_price * 1.1) {
            competitiveness = 'poor';
          }

          // Mettre à jour le variant
          const { error: updateError } = await supabaseClient
            .from('supplier_price_variants')
            .update({
              market_price: marketData.market_price,
              market_price_source: marketData.sources || 'Web search',
              market_price_updated_at: new Date().toISOString(),
              suggested_selling_price: Math.round(suggestedSellingPrice * 100) / 100,
              suggested_margin_percent: suggestedMargin,
              price_competitiveness: competitiveness,
              enrichment_status: 'completed',
              enrichment_error: null
            })
            .eq('id', variant.id);

          if (updateError) throw updateError;

          results.push({
            variant_id: variant.id,
            success: true,
            market_price: marketData.market_price,
            suggested_selling_price: suggestedSellingPrice,
            competitiveness
          });

          console.log(`[MARKET PRICING] ✅ Variant ${variant.id} enrichi: ${marketData.market_price}€ marché, ${suggestedSellingPrice}€ suggéré`);
        } else {
          // Pas de prix trouvé
          await supabaseClient
            .from('supplier_price_variants')
            .update({
              enrichment_status: 'failed',
              enrichment_error: 'Aucun prix marché trouvé'
            })
            .eq('id', variant.id);

          results.push({
            variant_id: variant.id,
            success: false,
            error: 'Aucun prix marché trouvé'
          });
        }
      } catch (error) {
        console.error(`[MARKET PRICING] ❌ Erreur variant ${variant.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await supabaseClient
          .from('supplier_price_variants')
          .update({
            enrichment_status: 'failed',
            enrichment_error: errorMessage
          })
          .eq('id', variant.id);

        results.push({
          variant_id: variant.id,
          success: false,
          error: errorMessage
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        enriched_count: results.filter(r => r.success).length,
        total_count: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MARKET PRICING] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
