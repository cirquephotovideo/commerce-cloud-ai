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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysis_id } = await req.json();

    // Récupérer toutes les données nécessaires
    const { data: analysis } = await supabaseClient
      .from('product_analyses')
      .select('*, specifications, long_description, cost_analysis, rsgp_compliance')
      .eq('id', analysis_id)
      .single();

    if (!analysis) {
      throw new Error('Product analysis not found');
    }

    // Vérifier les images
    const { count: imagesCount } = await supabaseClient
      .from('product_images')
      .select('*', { count: 'exact', head: true })
      .eq('analysis_id', analysis_id);

    // Vérifier Amazon data
    const { data: amazonData } = await supabaseClient
      .from('amazon_product_data')
      .select('asin')
      .eq('analysis_id', analysis_id)
      .maybeSingle();

    // Vérifier les prix fournisseurs
    const { data: priceVariants } = await supabaseClient
      .from('supplier_price_variants')
      .select('purchase_price, stock_quantity')
      .eq('analysis_id', analysis_id)
      .gt('stock_quantity', 0);

    // Vérifier les attributs Odoo
    const { data: odooAttrs } = await supabaseClient
      .from('odoo_attributes')
      .select('product_category, hs_code')
      .eq('analysis_id', analysis_id)
      .maybeSingle();

    // Calculer les scores de validation (8 critères)
    const validation = {
      description_ready: !!(analysis.long_description && analysis.long_description.length > 100),
      images_ready: (imagesCount || 0) >= 3,
      specifications_ready: !!(analysis.specifications && Object.keys(analysis.specifications).length > 5),
      pricing_ready: !!(priceVariants && priceVariants.length > 0),
      stock_ready: !!(priceVariants && priceVariants.some(v => v.stock_quantity > 0)),
      hs_code_ready: !!(odooAttrs?.hs_code),
      odoo_category_ready: !!(odooAttrs?.product_category),
      amazon_data_ready: !!(amazonData?.asin),
      last_validated_at: new Date().toISOString()
    };

    // Calculer le score de complétude (0-100%)
    const criteriaCount = Object.keys(validation).length - 1; // -1 pour last_validated_at
    const validCriteria = Object.entries(validation)
      .filter(([key, value]) => key !== 'last_validated_at' && value === true)
      .length;
    
    const completenessScore = Math.round((validCriteria / criteriaCount) * 100);

    // Liste des champs manquants
    const missingFields = [];
    if (!validation.description_ready) missingFields.push('description_longue');
    if (!validation.images_ready) missingFields.push('images_produit');
    if (!validation.specifications_ready) missingFields.push('specifications_techniques');
    if (!validation.pricing_ready) missingFields.push('prix_fournisseur');
    if (!validation.stock_ready) missingFields.push('stock_disponible');
    if (!validation.hs_code_ready) missingFields.push('code_hs');
    if (!validation.odoo_category_ready) missingFields.push('categorie_odoo');
    if (!validation.amazon_data_ready) missingFields.push('donnees_amazon');

    // Mettre à jour product_analyses
    const { error: updateError } = await supabaseClient
      .from('product_analyses')
      .update({
        pre_export_validation: {
          completeness_score: completenessScore,
          ...validation,
          missing_fields: missingFields
        }
      })
      .eq('id', analysis_id);

    if (updateError) throw updateError;

    console.log(`[PRE-EXPORT VALIDATION] Produit ${analysis_id}: ${completenessScore}% complet, ${missingFields.length} champs manquants`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id,
        completeness_score: completenessScore,
        validation,
        missing_fields: missingFields,
        ready_for_export: completenessScore >= 80
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PRE-EXPORT VALIDATION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
