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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { supplierId, userId, threshold = 70 } = await req.json();
    console.log('[AUTO-LINK] Starting auto-link for supplier:', supplierId, 'threshold:', threshold);

    // Récupérer les produits fournisseurs non liés
    const { data: supplierProducts, error: productsError } = await supabase
      .from('supplier_products')
      .select('id, name, ean, brand, supplier_reference')
      .eq('supplier_id', supplierId)
      .is('linked_analysis_id', null);

    if (productsError) throw productsError;
    if (!supplierProducts?.length) {
      console.log('[AUTO-LINK] No unlinked products found');
      return new Response(JSON.stringify({ 
        success: true, 
        linked_count: 0,
        message: 'Aucun produit à lier' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AUTO-LINK] Found', supplierProducts.length, 'unlinked products');

    // Récupérer toutes les analyses existantes de l'utilisateur
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('id, ean, analysis_result')
      .eq('user_id', userId);

    if (analysesError) throw analysesError;

    let linkedCount = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    for (const product of supplierProducts) {
      let bestMatch: { analysisId: string; score: number } | null = null;

      // 1. Tentative de match par EAN (100% de confiance)
      if (product.ean) {
        const eanMatch = analyses?.find(a => a.ean === product.ean);
        if (eanMatch) {
          bestMatch = { analysisId: eanMatch.id, score: 100 };
          console.log('[AUTO-LINK] EAN exact match for', product.name, '-> analysis', eanMatch.id);
        }
      }

      // 2. Si pas de match EAN, utiliser l'IA pour comparer nom + marque
      if (!bestMatch && LOVABLE_API_KEY) {
        try {
          const productDesc = `${product.brand || ''} ${product.name}`.trim().toLowerCase();
          
          // Comparer avec chaque analyse
          for (const analysis of analyses || []) {
            const analysisResult = analysis.analysis_result as any;
            const analysisName = analysisResult?.product_name || analysisResult?.name || '';
            const analysisBrand = analysisResult?.brand || '';
            const analysisDesc = `${analysisBrand} ${analysisName}`.trim().toLowerCase();

            if (!analysisDesc) continue;

            // Utiliser Lovable AI pour calculer la similarité
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'system',
                    content: 'Tu es un expert en comparaison de produits. Réponds uniquement avec un nombre entre 0 et 100 représentant le pourcentage de similarité entre deux produits.'
                  },
                  {
                    role: 'user',
                    content: `Compare ces deux produits et donne un score de similarité entre 0 et 100 :\n\nProduit 1: "${productDesc}"\nProduit 2: "${analysisDesc}"\n\nRéponds uniquement avec le nombre (ex: 85)`
                  }
                ],
                temperature: 0.3,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const scoreText = aiData.choices?.[0]?.message?.content?.trim() || '0';
              const score = parseInt(scoreText.match(/\d+/)?.[0] || '0');

              if (score > (bestMatch?.score || 0) && score >= threshold) {
                bestMatch = { analysisId: analysis.id, score };
                console.log('[AUTO-LINK] AI match for', product.name, '-> analysis', analysis.id, 'score:', score);
              }
            }
          }
        } catch (aiError) {
          console.error('[AUTO-LINK] AI matching error:', aiError);
        }
      }

      // 3. Créer le lien si un match suffisant est trouvé
      if (bestMatch && bestMatch.score >= threshold) {
        const { error: linkError } = await supabase
          .from('product_links')
          .insert({
            supplier_product_id: product.id,
            analysis_id: bestMatch.analysisId,
            link_type: bestMatch.score === 100 ? 'exact_ean' : 'automatic',
            confidence_score: bestMatch.score,
          });

        if (linkError) {
          console.error('[AUTO-LINK] Error creating link:', linkError);
        } else {
          linkedCount++;
          console.log('[AUTO-LINK] ✅ Linked product', product.id, 'to analysis', bestMatch.analysisId, `(${bestMatch.score}%)`);
        }
      }
    }

    console.log('[AUTO-LINK] Completed:', linkedCount, 'products linked');

    return new Response(JSON.stringify({ 
      success: true, 
      linked_count: linkedCount,
      total_products: supplierProducts.length,
      message: `${linkedCount} produit(s) lié(s) automatiquement sur ${supplierProducts.length}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[AUTO-LINK] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
