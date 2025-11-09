import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

enum PrestashopErrorCode {
  MISSING_CONFIG = 'MISSING_CONFIG',
  MISSING_API_KEY = 'MISSING_API_KEY',
  MISSING_URL = 'MISSING_URL',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_URL = 'INVALID_URL',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SUPPLIER_NOT_FOUND = 'SUPPLIER_NOT_FOUND',
}

interface ErrorResponse {
  error: string;
  error_code: PrestashopErrorCode;
  message: string;
  user_message: string;
  requires_configuration: boolean;
  details?: any;
}

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
    
    const { data: supplier, error: supplierError } = await supabaseClient
      .from('supplier_configurations')
      .select('supplier_type, connection_config')
      .eq('id', supplier_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (supplierError || !supplier) {
      console.error('[PRESTASHOP] Supplier not found:', supplierError);
      const errorResponse: ErrorResponse = {
        error: 'Supplier not found',
        error_code: PrestashopErrorCode.SUPPLIER_NOT_FOUND,
        message: `Supplier ${supplier_id} not found`,
        user_message: 'Le fournisseur PrestaShop est introuvable. Veuillez vérifier la configuration.',
        requires_configuration: false,
      };
      
      return new Response(
        JSON.stringify(errorResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (supplier.supplier_type !== 'prestashop') {
      throw new Error(`Type de fournisseur invalide: attendu prestashop, reçu ${supplier.supplier_type}`);
    }

    let sourceApiKey: string | null = supplier.connection_config?.api_key || null;
    let sourceShopUrl: string | null = supplier.connection_config?.platform_url || null;

    // Validate configuration with detailed checks
    if (!sourceApiKey || !sourceShopUrl) {
      // Try fallback to platform config
      const { data: platformConfig } = await supabaseClient
        .from('platform_configurations')
        .select('api_key_encrypted, platform_url')
        .eq('platform_type', 'prestashop')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .maybeSingle();

      if (!platformConfig) {
        // No configuration found at all
        const errorResponse: ErrorResponse = {
          error: 'Configuration required',
          error_code: PrestashopErrorCode.MISSING_CONFIG,
          message: 'PrestaShop configuration not found',
          user_message: 'Configuration PrestaShop manquante. Veuillez ajouter votre clé API et URL dans les paramètres du fournisseur.',
          requires_configuration: true,
        };

        if (mode === 'count') {
          return new Response(
            JSON.stringify({ 
              total_products: 0, 
              requires_configuration: true,
              error_code: PrestashopErrorCode.MISSING_CONFIG,
              user_message: errorResponse.user_message,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(errorResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sourceApiKey = platformConfig.api_key_encrypted;
      sourceShopUrl = platformConfig.platform_url;
    }

    // Validate specific fields
    if (!sourceApiKey) {
      const errorResponse: ErrorResponse = {
        error: 'API key missing',
        error_code: PrestashopErrorCode.MISSING_API_KEY,
        message: 'PrestaShop API key not configured',
        user_message: 'Clé API PrestaShop manquante. Veuillez l\'ajouter dans les paramètres du fournisseur.',
        requires_configuration: true,
      };

      if (mode === 'count') {
        return new Response(
          JSON.stringify({ 
            total_products: 0, 
            requires_configuration: true,
            error_code: PrestashopErrorCode.MISSING_API_KEY,
            user_message: errorResponse.user_message,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sourceShopUrl) {
      const errorResponse: ErrorResponse = {
        error: 'URL missing',
        error_code: PrestashopErrorCode.MISSING_URL,
        message: 'PrestaShop URL not configured',
        user_message: 'URL PrestaShop manquante. Veuillez l\'ajouter dans les paramètres du fournisseur.',
        requires_configuration: true,
      };

      if (mode === 'count') {
        return new Response(
          JSON.stringify({ 
            total_products: 0, 
            requires_configuration: true,
            error_code: PrestashopErrorCode.MISSING_URL,
            user_message: errorResponse.user_message,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedApiKey = sourceApiKey;
    const resolvedShopUrl = sourceShopUrl.replace(/\/$/, '');

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
      
      try {
        const countResponse = await fetch(countUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });

        if (!countResponse.ok) {
          const errorText = await countResponse.text();
          console.error('[PRESTASHOP] Count API error:', countResponse.status, errorText);
          
          // Handle specific HTTP status codes
          if (countResponse.status === 401 || countResponse.status === 403) {
            return new Response(
              JSON.stringify({
                total_products: 0,
                requires_configuration: true,
                error_code: PrestashopErrorCode.INVALID_CREDENTIALS,
                error: 'Authentication failed',
                message: `PrestaShop returned ${countResponse.status}`,
                user_message: 'Authentification PrestaShop échouée. Vérifiez que votre clé API est valide et que les permissions Webservice sont activées.',
                details: { status: countResponse.status, response: errorText.substring(0, 200) }
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (countResponse.status === 404) {
            return new Response(
              JSON.stringify({
                total_products: 0,
                requires_configuration: true,
                error_code: PrestashopErrorCode.INVALID_URL,
                error: 'API endpoint not found',
                message: 'PrestaShop API endpoint not found',
                user_message: 'URL PrestaShop invalide. Vérifiez que l\'URL est correcte et que le Webservice est activé (sans /api à la fin).',
                details: { status: 404, url: shopUrl }
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Generic API error
          return new Response(
            JSON.stringify({
              total_products: 0,
              error_code: PrestashopErrorCode.API_ERROR,
              error: 'PrestaShop API error',
              message: `PrestaShop API returned ${countResponse.status}`,
              user_message: `Erreur PrestaShop (${countResponse.status}). Vérifiez que votre boutique est accessible et que le Webservice est activé.`,
              details: { status: countResponse.status, response: errorText.substring(0, 200) }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const countData = await countResponse.json();
        const products = countData.products?.product || countData.products || [];
        const total = Array.isArray(products) ? products.length : (products ? 1 : 0);
        
        console.log('[PRESTASHOP] Total products found:', total);
        
        return new Response(
          JSON.stringify({ 
            total_products: total,
            requires_configuration: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      } catch (error: any) {
        console.error('[PRESTASHOP] Network error:', error);
        
        // Network/connection errors
        return new Response(
          JSON.stringify({
            total_products: 0,
            requires_configuration: true,
            error_code: PrestashopErrorCode.NETWORK_ERROR,
            error: 'Network error',
            message: error.message,
            user_message: 'Impossible de contacter PrestaShop. Vérifiez que l\'URL est correcte et que votre boutique est accessible.',
            details: { error: error.message }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // MODE IMPORT: Importer les produits avec pagination
    console.log('[PRESTASHOP] Import mode - fetching products with offset:', offset, 'limit:', limit);
    
    // Récupérer les produits avec pagination
    const chunkLimit = limit || 50;
    const chunkOffset = offset || 0;
    const productsUrl = `${shopUrl}/api/products?display=full&output_format=JSON&limit=${chunkLimit}&offset=${chunkOffset}`;
    
    try {
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PRESTASHOP] Import API error:', response.status, errorText);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error(JSON.stringify({
            error_code: PrestashopErrorCode.INVALID_CREDENTIALS,
            user_message: 'Authentification PrestaShop échouée. Vérifiez votre clé API.',
            details: { status: response.status }
          }));
        }
        
        if (response.status === 404) {
          throw new Error(JSON.stringify({
            error_code: PrestashopErrorCode.INVALID_URL,
            user_message: 'URL PrestaShop invalide. Vérifiez que l\'URL est correcte.',
            details: { status: 404 }
          }));
        }
        
        throw new Error(JSON.stringify({
          error_code: PrestashopErrorCode.API_ERROR,
          user_message: `Erreur PrestaShop (${response.status})`,
          details: { status: response.status, response: errorText.substring(0, 200) }
        }));
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
      console.error('[PRESTASHOP] Import error:', error);
      
      // Parse structured errors
      let errorResponse: ErrorResponse;
      
      try {
        const parsed = JSON.parse(error.message);
        errorResponse = {
          error: 'Import failed',
          error_code: parsed.error_code || PrestashopErrorCode.API_ERROR,
          message: error.message,
          user_message: parsed.user_message || 'Erreur lors de l\'import',
          requires_configuration: false,
          details: parsed.details,
        };
      } catch {
        // Not a structured error
        errorResponse = {
          error: 'Import failed',
          error_code: PrestashopErrorCode.NETWORK_ERROR,
          message: error.message,
          user_message: 'Erreur lors de l\'import des produits PrestaShop',
          requires_configuration: false,
        };
      }
      
      return new Response(
        JSON.stringify({
          ...errorResponse,
          imported: 0,
          matched: 0,
          new: 0,
          errors: 1,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('[PRESTASHOP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        error_code: 'UNKNOWN_ERROR',
        user_message: 'Une erreur inattendue s\'est produite',
        imported: 0,
        matched: 0,
        new: 0,
        errors: 1,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
