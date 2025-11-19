import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

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

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    const { analysisId } = await req.json();
    if (!analysisId) {
      throw new Error('analysisId requis');
    }

    console.log(`🔗 Linking suppliers for analysis ${analysisId}...`);

    // Get the EAN from product_analyses
    const { data: analysis, error: analysisError } = await supabaseClient
      .from('product_analyses')
      .select('ean, user_id')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Produit non trouvé');
    }

    if (analysis.user_id !== user.id) {
      throw new Error('Non autorisé');
    }

    if (!analysis.ean || analysis.ean === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ce produit n\'a pas d\'EAN',
          links_created: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find matching supplier products by EAN
    const { data: supplierProducts, error: supplierError } = await supabaseClient
      .from('supplier_products')
      .select('id, product_name, supplier_id')
      .eq('user_id', user.id)
      .eq('ean', analysis.ean);

    if (supplierError) throw supplierError;

    if (!supplierProducts || supplierProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Aucun produit fournisseur trouvé avec cet EAN',
          links_created: 0,
          ean: analysis.ean
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${supplierProducts.length} supplier products with EAN ${analysis.ean}`);

    // Create links for all matching suppliers
    let linksCreated = 0;
    const errors: any[] = [];

    for (const supplier of supplierProducts) {
      const { error: linkError } = await supabaseClient
        .from('product_links')
        .upsert({
          analysis_id: analysisId,
          supplier_product_id: supplier.id,
          link_type: 'auto',
          confidence_score: 1.0,
          user_id: user.id
        }, {
          onConflict: 'analysis_id,supplier_product_id'
        });

      if (linkError) {
        console.error(`Error linking supplier ${supplier.id}:`, linkError);
        errors.push({ supplier_id: supplier.id, error: linkError.message });
      } else {
        linksCreated++;
      }
    }

    // Merge data after linking
    const { error: mergeError } = await supabaseClient.rpc('merge_existing_links');
    if (mergeError) {
      console.error('Error merging data:', mergeError);
    }

    const result = {
      success: true,
      links_created: linksCreated,
      total_suppliers_found: supplierProducts.length,
      ean: analysis.ean,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('✅ Linking complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in link-single-product-suppliers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
