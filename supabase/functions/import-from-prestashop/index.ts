import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidEAN13(ean: string): boolean {
  if (!ean || !/^\d{13}$/.test(ean)) return false;
  const digits = ean.split('').map(Number);
  const checksum = digits[12];
  const sum = digits.slice(0, 12).reduce((acc, d, i) => 
    acc + d * (i % 2 === 0 ? 1 : 3), 0
  );
  return checksum === (10 - (sum % 10)) % 10;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_id, mode, offset, limit, import_job_id } = await req.json();

    if (!supplier_id) {
      throw new Error('supplier_id requis');
    }

    console.log('[PRESTASHOP] Request:', { supplier_id, mode, offset, limit });

    // Authentifier l'utilisateur
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Non authentifié');
    }
    
    console.log('[PRESTASHOP] User authenticated:', user.id);

    // Récupérer la configuration PrestaShop depuis la DB
    console.log('[PRESTASHOP] Fetching configuration for supplier:', supplier_id);
    
    // First get the supplier config to find the platform_configuration_id
    // Charger la config PrestaShop depuis le fournisseur ou sinon plateforme active
    const { data: supplier, error: supplierError } = await supabaseClient
      .from('supplier_configurations')
      .select('supplier_type, connection_config')
      .eq('id', supplier_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (supplierError || !supplier) {
      console.error('[PRESTASHOP] Supplier not found:', supplierError);
      throw new Error(`Fournisseur introuvable: ${supplier_id}`);
    }

    if (supplier.supplier_type !== 'prestashop') {
      throw new Error(`Type de fournisseur invalide: attendu prestashop, reçu ${supplier.supplier_type}`);
    }

    let sourceApiKey: string | null = supplier.connection_config?.api_key || null;
    let sourceShopUrl: string | null = supplier.connection_config?.platform_url || null;

    if (!sourceApiKey || !sourceShopUrl) {
      // Fallback: utiliser une configuration de plateforme PrestaShop active de l'utilisateur
      const { data: platformConfig, error: configError } = await supabaseClient
        .from('platform_configurations')
        .select('api_key_encrypted, platform_url')
        .eq('platform_type', 'prestashop')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .maybeSingle();

      if (configError || !platformConfig) {
        console.error('[PRESTASHOP] Configuration not found:', configError);
        throw new Error(`Configuration PrestaShop introuvable pour le fournisseur ${supplier_id}`);
      }

      sourceApiKey = platformConfig.api_key_encrypted;
      sourceShopUrl = platformConfig.platform_url;
    }

    const resolvedApiKey = sourceApiKey!;
    const resolvedShopUrl = (sourceShopUrl || '').replace(/\/$/, '');

    console.log('[PRESTASHOP] Configuration loaded successfully');

    // PrestaShop Webservice API
    const apiKey = resolvedApiKey;
    const shopUrl = resolvedShopUrl;
    
    // Basic Auth avec API key PrestaShop
    const auth = btoa(`${apiKey}:`);

    // MODE COUNT: Retourner juste le nombre de produits
    if (mode === 'count') {
      console.log('[PRESTASHOP] Count mode - fetching product count');
      const countUrl = `${shopUrl}/api/products?display=[id]&output_format=JSON`;
      
      const countResponse = await fetch(countUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });

      if (!countResponse.ok) {
        const errorText = await countResponse.text();
        console.error('[PRESTASHOP] Count error:', errorText);
        throw new Error(`Erreur lors du comptage: ${countResponse.status}`);
      }

      const countData = await countResponse.json();
      const products = countData.products?.product || countData.products || [];
      const total = Array.isArray(products) ? products.length : (products ? 1 : 0);
      
      console.log('[PRESTASHOP] Total products found:', total);
      
      return new Response(
        JSON.stringify({ total_products: total }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE IMPORT: Importer les produits avec pagination
    console.log('[PRESTASHOP] Import mode - fetching products with offset:', offset, 'limit:', limit);
    
    // Récupérer les produits avec pagination
    const chunkLimit = limit || 50;
    const chunkOffset = offset || 0;
    const productsUrl = `${shopUrl}/api/products?display=full&output_format=JSON&limit=${chunkLimit}&offset=${chunkOffset}`;
    
    const response = await fetch(productsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PrestaShop API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : 
                     (data.products?.product ? (Array.isArray(data.products.product) ? data.products.product : [data.products.product]) : []);

    console.log(`[PRESTASHOP] Found ${products.length} products in this chunk`);

    let imported = 0, matched = 0, errors = 0;
    const errorDetails: any[] = [];

    for (const product of products) {
      try {
        // PrestaShop structure
        const ean = product.ean13 && isValidEAN13(product.ean13) ? product.ean13 : null;
        const price = parseFloat(product.price || product.wholesale_price || 0);
        const stockQty = parseInt(product.quantity || 0);

        const productData = {
          user_id: user.id,
          supplier_id: supplier_id,
          supplier_reference: product.reference || `ps_${product.id}`,
          ean: ean,
          product_name: product.name?.[0]?.value || product.name || 'Product',
          purchase_price: price,
          stock_quantity: stockQty,
          currency: 'EUR',
          supplier_url: `${shopUrl}/admin-dev/index.php?controller=AdminProducts&id_product=${product.id}`,
          description: product.description?.[0]?.value || null,
          brand: product.manufacturer_name || null,
        };

        const { data: supplierProduct, error: insertError } = await supabaseClient
          .from('supplier_products')
          .upsert(productData, {
            onConflict: 'user_id,supplier_id,supplier_reference',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        imported++;

        // Try to match with existing analysis by EAN
        if (ean) {
          const { data: analysis } = await supabaseClient
            .from('product_analyses')
            .select('id')
            .eq('user_id', user.id)
            .eq('ean', ean)
            .maybeSingle();

          if (analysis) {
            await supabaseClient
              .from('product_analyses')
              .update({
                supplier_product_id: supplierProduct.id,
                purchase_price: price,
                purchase_currency: 'EUR',
              })
              .eq('id', analysis.id);
            
            await supabaseClient
              .from('supplier_products')
              .update({ enrichment_status: 'completed', enrichment_progress: 100 })
              .eq('id', supplierProduct.id);
            
            matched++;
          }
        }
      } catch (err: any) {
        console.error('[PRESTASHOP] Product error:', err);
        errors++;
        errorDetails.push({
          product: product.name || product.id,
          error: err.message,
        });
      }
    }

    // Log import
    await supabaseClient.from('supplier_import_logs').insert({
      user_id: user.id,
      supplier_id: supplier_id,
      import_type: 'prestashop_api',
      source_file: 'prestashop_webservice',
      products_found: products.length,
      products_matched: matched,
      products_new: imported - matched,
      products_updated: matched,
      products_failed: errors,
      import_status: errors === 0 ? 'success' : errors < products.length ? 'partial' : 'failed',
    });

    // Update supplier sync time
    if (supplier_id) {
      await supabaseClient
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplier_id);
    }

    // Déterminer s'il y a plus de produits
    const hasMore = products.length === chunkLimit;
    const nextOffset = chunkOffset + chunkLimit;

    console.log(`[PRESTASHOP] Chunk complete: ${imported} imported, ${matched} matched, ${errors} errors, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        imported,
        matched,
        new: imported - matched,
        errors,
        errorDetails: errorDetails.slice(0, 10),
        hasMore,
        nextOffset,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[PRESTASHOP] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        imported: 0,
        matched: 0,
        new: 0,
        errors: 1,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
