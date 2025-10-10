import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation EAN-13
function isValidEAN13(ean: string): boolean {
  if (!ean || !/^\d{13}$/.test(ean)) return false;
  
  const digits = ean.split('').map(Number);
  const checksum = digits[12];
  const sum = digits.slice(0, 12).reduce((acc, d, i) => 
    acc + d * (i % 2 === 0 ? 1 : 3), 0
  );
  const calculatedChecksum = (10 - (sum % 10)) % 10;
  
  return checksum === calculatedChecksum;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_id, config } = await req.json();
    
    console.log('Starting Odoo import for supplier:', supplier_id);

    // Determine which key to use based on auth context with robust JWT validation
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let supabaseClient: any;
    let userId!: string; // Will be assigned in either UI auth or auto-sync mode
    let isAutoSync = false;

    // Validate JWT format (3 segments separated by dots)
    const isValidJWT = bearer && bearer.split('.').length === 3;

    if (isValidJWT) {
      // Try UI mode first
      console.log('🔐 Attempting UI authentication with Bearer token');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY')!
      );

      try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(bearer);
        
        if (authError) {
          console.log('⚠️ Auth error detected:', authError.message);
          if (authError.message?.includes('bad_jwt') || authError.message?.includes('invalid')) {
            console.log('🔄 Detected invalid/expired JWT, falling back to auto-sync mode');
            isAutoSync = true;
          } else {
            throw new Error(`Authentication failed: ${authError.message}`);
          }
        } else if (!user) {
          console.log('🔄 No user found, falling back to auto-sync mode');
          isAutoSync = true;
        } else {
          userId = user.id;
          console.log('✅ Authenticated user:', userId);
        }
      } catch (err: any) {
        console.log('🔄 Auth exception, falling back to auto-sync mode:', err.message);
        isAutoSync = true;
      }
    } else {
      console.log('🔧 No valid Bearer token detected, using auto-sync mode');
      isAutoSync = true;
    }

    // If auto-sync mode, recreate client with SERVICE_ROLE_KEY and fetch user_id
    if (isAutoSync) {
      console.log('✅ Using SERVICE_ROLE_KEY for auto-sync');
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Get user_id from supplier configuration
      const { data: supplier, error: supplierError } = await supabaseClient
        .from('supplier_configurations')
        .select('user_id')
        .eq('id', supplier_id)
        .single();

      if (supplierError || !supplier) {
        console.error('❌ Supplier not found:', supplierError);
        throw new Error('Supplier configuration not found');
      }

      userId = supplier.user_id;
      console.log('✅ Using user_id from supplier:', userId);
    }

    // Get Odoo configuration
    let odooConfig = config;
    if (!odooConfig) {
      const { data: platformConfig, error: configError } = await supabaseClient
        .from('platform_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('platform_type', 'odoo')
        .eq('is_active', true)
        .maybeSingle();
      
      if (configError || !platformConfig) {
        console.error('Platform config error:', configError);
        throw new Error('Odoo platform configuration not found');
      }
      odooConfig = platformConfig;
    }

    // 1. Extract credentials with fallback logic
    const additionalConfig = odooConfig.additional_config || {};
    const odooUrl = odooConfig.platform_url;
    const database = additionalConfig.database || odooConfig.api_key_encrypted || 'odoo';
    const username = additionalConfig.username || odooConfig.api_secret_encrypted;
    const password = additionalConfig.password || odooConfig.access_token_encrypted;

    console.log('[ODOO] Configuration extracted:', {
      url: odooUrl,
      database: database,
      username: username ? '***' : 'missing',
      password: password ? '***' : 'missing'
    });

    if (!odooUrl || !database || !username || !password) {
      throw new Error('Incomplete Odoo credentials. Please check Platform Configuration (URL, Database, Username, Password).');
    }

    const authPayload = `<?xml version="1.0"?>
      <methodCall>
        <methodName>authenticate</methodName>
        <params>
          <param><string>${database}</string></param>
          <param><string>${username}</string></param>
          <param><string>${password}</string></param>
          <param><struct></struct></param>
        </params>
      </methodCall>`;

    console.log('[ODOO] Authenticating with Odoo...');
    const authResponse = await fetch(`${odooUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authPayload,
    });

    const authText = await authResponse.text();
    console.log('[ODOO] Auth response status:', authResponse.status);
    console.log('[ODOO] Auth response:', authText.substring(0, 300));

    if (!authResponse.ok) {
      throw new Error(`Odoo authentication failed (HTTP ${authResponse.status}): ${authText.substring(0, 200)}`);
    }
    
    const uidMatch = authText.match(/<int>(\d+)<\/int>/);
    if (!uidMatch) {
      console.error('[ODOO] Failed to parse UID from response:', authText.substring(0, 500));
      throw new Error('Odoo authentication failed - invalid credentials or database name');
    }
    const uid = parseInt(uidMatch[1]);

    console.log('[ODOO] Authenticated with UID:', uid);

    // 2. Rechercher TOUS les produits actifs avec pagination
    const allProducts: any[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    console.log('[ODOO] Starting paginated product fetch...');

    while (hasMore) {
      const searchPayload = `<?xml version="1.0"?>
        <methodCall>
          <methodName>execute_kw</methodName>
          <params>
            <param><string>${database}</string></param>
            <param><int>${uid}</int></param>
            <param><string>${password}</string></param>
            <param><string>product.product</string></param>
            <param><string>search_read</string></param>
            <param>
              <array><data>
                <value><array><data>
                  <value><array><data>
                    <value><string>active</string></value>
                    <value><string>=</string></value>
                    <value><boolean>1</boolean></value>
                  </data></array></value>
                </data></array></value>
              </data></array>
            </param>
            <param>
              <struct>
                <member>
                  <name>fields</name>
                  <value><array><data>
                    <value><string>barcode</string></value>
                    <value><string>default_code</string></value>
                    <value><string>name</string></value>
                    <value><string>standard_price</string></value>
                    <value><string>lst_price</string></value>
                    <value><string>qty_available</string></value>
                  </data></array></value>
                </member>
                <member>
                  <name>limit</name>
                  <value><int>${limit}</int></value>
                </member>
                <member>
                  <name>offset</name>
                  <value><int>${offset}</int></value>
                </member>
              </struct>
            </param>
          </params>
        </methodCall>`;

      const productsResponse = await fetch(`${odooUrl}/xmlrpc/2/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: searchPayload,
      });

      const productsXML = await productsResponse.text();
      console.log(`[ODOO] Page ${Math.floor(offset/limit) + 1} - Status:`, productsResponse.status);

      if (!productsResponse.ok) {
        throw new Error(`Odoo products fetch failed (HTTP ${productsResponse.status})`);
      }
      
      // Parser XML amélioré pour extraire correctement les valeurs
      const productMatches = productsXML.match(/<struct>[\s\S]*?<\/struct>/g) || [];
      
      if (productMatches.length === 0) {
        hasMore = false;
        break;
      }

      for (const structMatch of productMatches) {
        // Extraction améliorée qui préserve les types
        const extractValue = (key: string, type: 'string' | 'double' | 'int' = 'string') => {
          const regex = new RegExp(`<name>${key}</name>\\s*<value><${type}>([^<]*)<\/${type}><\/value>`, 's');
          const m = structMatch.match(regex);
          return m ? m[1].trim() : null;
        };

        const extractStringOrFalse = (key: string) => {
          // Gère <string>value</string> ou <boolean>0</boolean> (False)
          const strMatch = structMatch.match(new RegExp(`<name>${key}</name>\\s*<value><string>([^<]*)</string></value>`, 's'));
          if (strMatch) return strMatch[1].trim();
          
          const boolMatch = structMatch.match(new RegExp(`<name>${key}</name>\\s*<value><boolean>([01])</boolean></value>`, 's'));
          if (boolMatch && boolMatch[1] === '0') return null;
          
          return null;
        };

        const name = extractValue('name', 'string');
        if (!name) continue; // Skip si pas de nom

        const product = {
          default_code: extractStringOrFalse('default_code'),
          barcode: extractStringOrFalse('barcode'),
          name: name,
          standard_price: parseFloat(extractValue('standard_price', 'double') || '0'),
          lst_price: parseFloat(extractValue('lst_price', 'double') || '0'),
          qty_available: parseInt(extractValue('qty_available', 'int') || '0'),
        };

        allProducts.push(product);
      }

      console.log(`[ODOO] Page ${Math.floor(offset/limit) + 1}: ${productMatches.length} products`);
      
      // Continue si on a reçu exactement "limit" produits
      if (productMatches.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`[ODOO] Total found: ${allProducts.length} products`);

    // 3. Importer dans supplier_products
    let imported = 0, matched = 0, errors = 0;
    const errorDetails = [];

    for (const product of allProducts) {
      try {
        // Valider et nettoyer EAN
        const rawEan = product.barcode?.trim();
        const ean = rawEan && isValidEAN13(rawEan) ? rawEan : null;

        // Insérer/Update supplier_product
        const { data: supplierProduct, error: insertError } = await supabaseClient
          .from('supplier_products')
          .upsert({
            user_id: userId,
            supplier_id: supplier_id,
            supplier_reference: product.default_code || `odoo_${Date.now()}_${Math.random()}`,
            ean: ean,
            product_name: product.name,
            purchase_price: product.standard_price,
            stock_quantity: product.qty_available,
            currency: 'EUR',
            additional_data: { lst_price: product.lst_price },
          }, {
            onConflict: 'user_id,supplier_id,supplier_reference',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        imported++;

        // Matching automatique par EAN
        if (ean) {
          const { data: analysis } = await supabaseClient
            .from('product_analyses')
            .select('id')
            .eq('user_id', userId)
            .eq('ean', ean)
            .maybeSingle();

          if (analysis) {
            await supabaseClient
              .from('product_analyses')
              .update({
                supplier_product_id: supplierProduct.id,
                purchase_price: product.standard_price,
                purchase_currency: 'EUR',
              })
              .eq('id', analysis.id);
            
            matched++;
          }
        }

      } catch (err: any) {
        errors++;
        errorDetails.push({
          product: product.name,
          reference: product.default_code,
          error: err.message,
        });
      }
    }

    // 4. Logger l'import
    await supabaseClient.from('supplier_import_logs').insert({
      user_id: userId,
      supplier_id: supplier_id,
      import_type: 'odoo_api',
      products_count: allProducts.length,
      success_count: imported,
      error_count: errors,
      error_details: errorDetails.length > 0 ? errorDetails : null,
    });

    // 5. Mettre à jour last_sync_at
    if (supplier_id) {
      await supabaseClient
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplier_id);
    }

    console.log('Odoo import completed:', { imported, matched, errors });

    return new Response(
      JSON.stringify({
        found: allProducts.length,
        imported,
        matched,
        new: imported - matched,
        errors,
        errorDetails: errorDetails.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in import-from-odoo:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        imported: 0,
        matched: 0,
        new: 0,
        errors: 1,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
