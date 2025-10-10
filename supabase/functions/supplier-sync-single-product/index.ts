import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_name: string;
  ean?: string;
  supplier_reference?: string;
  purchase_price: number;
  currency: string;
  stock_quantity?: number;
  delivery_time_days?: number;
  minimum_order_quantity?: number;
  supplier_url?: string;
  metadata?: Record<string, any>;
  updated_at?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { productId } = await req.json();

    if (!productId) {
      throw new Error('productId est requis');
    }

    console.log(`🔄 Démarrage de la synchronisation pour le produit ${productId}`);

    // 1. Récupérer le produit fournisseur
    const { data: product, error: productError } = await supabaseClient
      .from('supplier_products')
      .select('*, supplier_configurations(*)')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error('Produit introuvable');
    }

    const supplierConfig = product.supplier_configurations;
    if (!supplierConfig) {
      throw new Error('Configuration fournisseur introuvable');
    }

    console.log(`✅ Produit trouvé: ${product.product_name}`);
    console.log(`📦 Fournisseur: ${supplierConfig.supplier_name} (Type: ${supplierConfig.supplier_type})`);

    // 2. Re-synchroniser selon le type de fournisseur
    let updatedData: Partial<SupplierProduct> = {};

    if (supplierConfig.supplier_type === 'ftp' || supplierConfig.supplier_type === 'sftp') {
      // Cas FTP/SFTP : Appeler supplier-sync-ftp
      console.log('🔄 Re-sync FTP/SFTP en cours...');
      const { data: ftpData, error: ftpError } = await supabaseClient.functions.invoke('supplier-sync-ftp', {
        body: {
          supplierId: product.supplier_id,
          singleProductId: productId, // Option pour ne sync que ce produit
        },
      });

      if (ftpError) {
        console.error('❌ Erreur FTP sync:', ftpError);
        throw new Error(`Erreur FTP: ${ftpError.message}`);
      }

      updatedData = ftpData?.updatedProduct || {};
    } else if (supplierConfig.supplier_type === 'api') {
      // Cas API : Appeler supplier-sync-api
      console.log('🔄 Re-sync API en cours...');
      const { data: apiData, error: apiError } = await supabaseClient.functions.invoke('supplier-sync-api', {
        body: {
          supplierId: product.supplier_id,
          singleProductReference: product.supplier_reference,
        },
      });

      if (apiError) {
        console.error('❌ Erreur API sync:', apiError);
        throw new Error(`Erreur API: ${apiError.message}`);
      }

      updatedData = apiData?.updatedProduct || {};
    } else {
      throw new Error(`Type de fournisseur non supporté: ${supplierConfig.supplier_type}`);
    }

    // 3. Mettre à jour le produit dans la base
    const { data: updated, error: updateError } = await supabaseClient
      .from('supplier_products')
      .update({
        ...updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erreur mise à jour produit:', updateError);
      throw updateError;
    }

    console.log('✅ Produit synchronisé avec succès !');

    // 4. Si le produit est lié à une analyse, on peut optionnellement la re-enrichir
    const { data: linkedAnalysis } = await supabaseClient
      .from('product_links')
      .select('analysis_id')
      .eq('supplier_product_id', productId)
      .limit(1)
      .maybeSingle();

    if (linkedAnalysis?.analysis_id) {
      console.log(`🔗 Produit lié à l'analyse ${linkedAnalysis.analysis_id}`);
      // Optionnel : déclencher re-enrichissement
      // await supabaseClient.functions.invoke('re-enrich-product', {
      //   body: { productId, enrichmentTypes: ['ai_analysis'] }
      // });
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: updated,
        message: 'Produit synchronisé avec succès depuis le fournisseur',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erreur supplier-sync-single-product:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
