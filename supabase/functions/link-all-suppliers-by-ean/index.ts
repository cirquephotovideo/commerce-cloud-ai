import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const { analysisId } = await req.json();

    if (!analysisId) {
      throw new Error('analysisId requis');
    }

    console.log('🔗 Auto-link de tous les fournisseurs pour analysis:', analysisId);

    // 1. Récupérer l'EAN du produit analysé
    const { data: analysis, error: analysisError } = await supabaseClient
      .from('product_analyses')
      .select('ean, normalized_ean, user_id')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Analyse introuvable');
    }

    if (!analysis.normalized_ean && !analysis.ean) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ce produit n\'a pas d\'EAN',
          links_created: 0,
          total_suppliers_found: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchEan = analysis.normalized_ean || analysis.ean;

    // 2. Trouver TOUS les supplier_products avec ce même EAN
    const { data: supplierProducts, error: spError } = await supabaseClient
      .from('supplier_products')
      .select(`
        id,
        supplier_id,
        product_name,
        purchase_price,
        stock_quantity,
        supplier_reference,
        ean,
        normalized_ean,
        supplier_configurations(supplier_name, supplier_type)
      `)
      .eq('user_id', analysis.user_id)
      .or(`normalized_ean.eq.${searchEan},ean.eq.${searchEan}`);

    if (spError) {
      console.error('Erreur fetch supplier_products:', spError);
      throw spError;
    }

    const totalSuppliersFound = supplierProducts?.length || 0;
    console.log(`📦 ${totalSuppliersFound} fournisseur(s) trouvé(s) pour EAN: ${searchEan}`);

    if (!supplierProducts || supplierProducts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Aucun fournisseur trouvé pour cet EAN',
          links_created: 0,
          total_suppliers_found: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Créer les liens manquants (batch insert avec ON CONFLICT)
    const linksToCreate = supplierProducts.map(sp => ({
      analysis_id: analysisId,
      supplier_product_id: sp.id,
      link_type: 'auto',
      confidence_score: 1.0,
      user_id: analysis.user_id,
    }));

    const { data: insertedLinks, error: linkError } = await supabaseClient
      .from('product_links')
      .upsert(linksToCreate, {
        onConflict: 'analysis_id,supplier_product_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (linkError) {
      console.error('Erreur création liens:', linkError);
      throw linkError;
    }

    const linksCreated = insertedLinks?.length || 0;
    console.log(`✅ ${linksCreated} lien(s) créé(s)`);

    // 4. Déclencher la reconstruction des supplier_price_variants pour cette analyse
    const { error: variantError } = await supabaseClient.rpc('sync_supplier_price_variants_for_analysis', {
      p_analysis_id: analysisId,
    });

    if (variantError) {
      console.warn('⚠️ Erreur sync variants (non bloquant):', variantError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        links_created: linksCreated,
        total_suppliers_found: totalSuppliersFound,
        ean: searchEan,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erreur auto-link:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
