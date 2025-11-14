import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Write log to import_logs table
async function writeLog(supabaseClient: any, params: {
  jobId?: string;
  userId: string;
  supplierId?: string;
  functionName: string;
  step: string;
  level?: string;
  message: string;
  context?: any;
}) {
  if (!params.jobId) return; // Skip if no job ID
  
  try {
    await supabaseClient.from('import_logs').insert([{
      job_id: params.jobId,
      user_id: params.userId,
      supplier_id: params.supplierId ?? null,
      function_name: params.functionName,
      step: params.step,
      level: params.level ?? 'info',
      message: params.message,
      context: params.context ?? {}
    }]);
  } catch (err) {
    console.error('[LOG] Failed to write log:', err);
  }
}

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
    const { supplier_id, config, mode = 'import', offset = 0, limit = 1000, import_job_id } = await req.json();
    
    console.log('[ODOO-IMPORT] Starting with mode:', mode, 'supplier:', supplier_id, 'offset:', offset, 'limit:', limit);

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
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${bearer}`,
            },
          },
        }
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
    const configuredUrl = odooConfig.platform_url;
    const database = additionalConfig.database || additionalConfig.db || odooConfig.api_key_encrypted || 'odoo';
    const username = additionalConfig.username || additionalConfig.login || additionalConfig.user || odooConfig.api_secret_encrypted;
    const password = additionalConfig.password || additionalConfig.pass || odooConfig.access_token_encrypted;

    console.log('[ODOO] Configuration extracted:', {
      url: configuredUrl,
      database: database,
      username: username ? '***' : 'missing',
      password: password ? '***' : 'missing'
    });

    if (!configuredUrl || !database || !username || !password) {
      throw new Error('Incomplete Odoo credentials. Please check Platform Configuration (URL, Database, Username, Password).');
    }

    // 2. Build XML-RPC endpoint candidates
    const buildXmlRpcCandidates = (url: string): string[] => {
      try {
        const urlObj = new URL(url);
        const origin = `${urlObj.protocol}//${urlObj.host}`;
        const path = urlObj.pathname;
        
        const candidates: string[] = [];
        
        // Priority 1: Origin root (most common)
        candidates.push(`${origin}/xmlrpc/2`);
        
        // Priority 2: With /odoo prefix
        if (!path.includes('/odoo')) {
          candidates.push(`${origin}/odoo/xmlrpc/2`);
        }
        
        // Priority 3: Use configured path if exists and different
        if (path && path !== '/' && !candidates.includes(`${origin}${path}/xmlrpc/2`)) {
          candidates.push(`${origin}${path}/xmlrpc/2`);
        }
        
        return candidates;
      } catch (e) {
        // Fallback if URL parsing fails
        return [`${url}/xmlrpc/2`];
      }
    };

    const xmlRpcCandidates = buildXmlRpcCandidates(configuredUrl);
    console.log('[ODOO] XML-RPC endpoint candidates:', xmlRpcCandidates.map(c => c.replace(/https?:\/\/[^\/]+/, '[REDACTED]')));

    // 3. Try authentication on each candidate
    const tryAuthenticate = async (baseUrl: string): Promise<{ success: boolean; uid?: number; error?: string; responseText?: string }> => {
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

      try {
        const authResponse = await fetch(`${baseUrl}/common`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: authPayload,
        });

        const authText = await authResponse.text();
        
        // Check for HTML response (wrong endpoint)
        if (authText.includes('<!doctype html>') || authText.includes('<html')) {
          return { 
            success: false, 
            error: `Wrong endpoint (got HTML): ${authText.substring(0, 100)}`,
            responseText: authText.substring(0, 300)
          };
        }

        // Check for XML-RPC response
        if (!authResponse.ok) {
          return { 
            success: false, 
            error: `HTTP ${authResponse.status}`,
            responseText: authText.substring(0, 300)
          };
        }

        // Try to parse UID
        const uidMatch = authText.match(/<int>(\d+)<\/int>/);
        if (!uidMatch) {
          return { 
            success: false, 
            error: 'No UID in response (invalid credentials or database?)',
            responseText: authText.substring(0, 300)
          };
        }

        const uid = parseInt(uidMatch[1]);
        if (uid <= 0) {
          return { 
            success: false, 
            error: 'Invalid UID (authentication rejected)',
            responseText: authText.substring(0, 300)
          };
        }

        return { success: true, uid };
      } catch (err: any) {
        return { 
          success: false, 
          error: `Network error: ${err.message}` 
        };
      }
    };

    // Try each candidate until one succeeds
    let authenticatedBaseUrl: string | null = null;
    let uid: number | null = null;
    const authAttempts: Array<{ url: string; result: string }> = [];

    for (const candidateBase of xmlRpcCandidates) {
      console.log(`[ODOO] Trying authentication at: ${candidateBase.replace(/https?:\/\/[^\/]+/, '[REDACTED]')}/common`);
      const result = await tryAuthenticate(candidateBase);
      
      authAttempts.push({
        url: candidateBase.replace(/https?:\/\/[^\/]+/, '[REDACTED]'),
        result: result.success ? `✅ Success (UID: ${result.uid})` : `❌ ${result.error}`
      });

      if (result.success) {
        authenticatedBaseUrl = candidateBase;
        uid = result.uid!;
        console.log(`[ODOO] ✅ Authentication successful at: ${candidateBase.replace(/https?:\/\/[^\/]+/, '[REDACTED]')} (UID: ${uid})`);
        break;
      } else {
        console.log(`[ODOO] ❌ Authentication failed at ${candidateBase.replace(/https?:\/\/[^\/]+/, '[REDACTED]')}: ${result.error}`);
      }
    }

    // If all candidates failed, throw detailed error
    if (!authenticatedBaseUrl || !uid) {
      const attemptsSummary = authAttempts.map(a => `  - ${a.url}: ${a.result}`).join('\n');
      throw new Error(
        `Odoo authentication failed on all endpoints:\n${attemptsSummary}\n\n` +
        `Please verify:\n` +
        `1. URL is correct (try without /odoo path)\n` +
        `2. Database name: "${database}"\n` +
        `3. Username and password are valid`
      );
    }

    const odooBaseUrl = authenticatedBaseUrl;
    console.log('[ODOO] Using XML-RPC base:', odooBaseUrl.replace(/https?:\/\/[^\/]+/, '[REDACTED]'));

    // MODE: test - just return success after authentication
    if (mode === 'test') {
      return new Response(
        JSON.stringify({ success: true, message: 'Authentication successful' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. First get the total count of active product templates
    console.log('[ODOO] Getting total product template count...');
    const countPayload = `<?xml version="1.0"?>
      <methodCall>
        <methodName>execute_kw</methodName>
        <params>
          <param><string>${database}</string></param>
          <param><int>${uid}</int></param>
          <param><string>${password}</string></param>
          <param><string>product.template</string></param>
          <param><string>search_count</string></param>
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
        </params>
      </methodCall>`;

    const countResponse = await fetch(`${odooBaseUrl}/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: countPayload,
    });

    const countText = await countResponse.text();
    const countMatch = countText.match(/<int>(\d+)<\/int>/);
    const totalCount = countMatch ? parseInt(countMatch[1]) : 0;
    console.log(`[ODOO] ✅ Total active products in Odoo: ${totalCount}`);

    // MODE: count - just return the count
    if (mode === 'count') {
      return new Response(
        JSON.stringify({ total_products: totalCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE: import - fetch and import chunk
    // 3. Fetch products for this chunk only
    const allProducts: any[] = [];
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    console.log(`[ODOO] 📦 Fetching chunk ${currentPage}/${totalPages} (offset: ${offset}, limit: ${limit})`);

    const searchPayload = `<?xml version="1.0"?>
        <methodCall>
          <methodName>execute_kw</methodName>
          <params>
            <param><string>${database}</string></param>
            <param><int>${uid}</int></param>
            <param><string>${password}</string></param>
            <param><string>product.template</string></param>
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
                    <value><string>id</string></value>
                    <value><string>barcode</string></value>
                    <value><string>default_code</string></value>
                    <value><string>name</string></value>
                    <value><string>standard_price</string></value>
                    <value><string>list_price</string></value>
                    <value><string>qty_available</string></value>
                    <value><string>image_1920</string></value>
                    <value><string>image_512</string></value>
                    <value><string>image_256</string></value>
                    <value><string>description</string></value>
                    <value><string>description_sale</string></value>
                    <value><string>categ_id</string></value>
                    <value><string>weight</string></value>
                    <value><string>volume</string></value>
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

      const productsResponse = await fetch(`${odooBaseUrl}/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: searchPayload,
      });

      const productsXML = await productsResponse.text();

      if (!productsResponse.ok) {
        throw new Error(`Odoo products fetch failed (HTTP ${productsResponse.status})`);
      }
      
      // Parser XML amélioré pour extraire correctement les valeurs
      const productMatches = productsXML.match(/<struct>[\s\S]*?<\/struct>/g) || [];
      
      if (productMatches.length === 0) {
        console.log(`[ODOO] ⚠️ No more products found at offset ${offset}`);
        // No more products in this chunk - return early
        if (import_job_id) {
          await supabaseClient
            .from('import_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', import_job_id);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            imported: 0, 
            matched: 0, 
            errors: 0,
            hasMore: false,
            totalCount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[ODOO] ✓ Parsed ${productMatches.length} products from page`);

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

        const extractArray = (key: string) => {
          // Extrait les valeurs array comme categ_id [id, name]
          const regex = new RegExp(`<name>${key}</name>\\s*<value><array><data>([\\s\\S]*?)</data></array></value>`, 's');
          const match = structMatch.match(regex);
          if (!match) return null;
          
          const content = match[1];
          const intMatch = content.match(/<int>(\d+)<\/int>/);
          const stringMatch = content.match(/<string>([^<]*)<\/string>/);
          
          if (intMatch && stringMatch) {
            return [parseInt(intMatch[1]), stringMatch[1].trim()];
          }
          return null;
        };

        const name = extractValue('name', 'string');
        if (!name) continue; // Skip si pas de nom

        const product = {
          id: parseInt(extractValue('id', 'int') || '0'),
          default_code: extractStringOrFalse('default_code'),
          barcode: extractStringOrFalse('barcode'),
          name: name,
          standard_price: parseFloat(extractValue('standard_price', 'double') || '0'),
          list_price: parseFloat(extractValue('list_price', 'double') || '0'),
          qty_available: parseInt(extractValue('qty_available', 'int') || '0'),
          image_1920: extractStringOrFalse('image_1920'),
          image_512: extractStringOrFalse('image_512'),
          image_256: extractStringOrFalse('image_256'),
          description: extractStringOrFalse('description'),
          description_sale: extractStringOrFalse('description_sale'),
          categ_id: extractArray('categ_id'),
          weight: parseFloat(extractValue('weight', 'double') || '0') || null,
          volume: parseFloat(extractValue('volume', 'double') || '0') || null,
        };

      allProducts.push(product);
    }

    console.log(`[ODOO] ✅ Chunk products collected: ${allProducts.length}`);

    // Log chunk parsed
    await writeLog(supabaseClient, {
      jobId: import_job_id,
      userId,
      supplierId: supplier_id,
      functionName: 'import-from-odoo',
      step: 'odoo_chunk_parsed',
      message: `Parsed ${allProducts.length} product templates from Odoo`,
      context: { count: allProducts.length, offset, limit }
    });

    // 3. Importer dans supplier_products - BATCH OPTIMIZED
    let imported = 0, matched = 0, errors = 0;

    // Phase 1: Collecter tous les produits à insérer
    const productsToInsert = [];
    for (const product of allProducts) {
      // Valider et nettoyer EAN
      const rawEan = product.barcode?.trim();
      const ean = rawEan && isValidEAN13(rawEan) ? rawEan : null;

      productsToInsert.push({
        user_id: userId,
        supplier_id: supplier_id,
        supplier_reference: product.default_code || `odoo_id_${product.id}`,
        ean: ean,
        product_name: product.name,
        purchase_price: product.standard_price || 0,
        stock_quantity: product.qty_available || 0,
        currency: 'EUR',
        description: product.description || product.description_sale || null,
        additional_data: {
          list_price: product.list_price,
          // Exclure temporairement les images volumineuses pour éviter timeout
          // image_1920: product.image_1920 || null,
          // image_512: product.image_512 || null,
          image_256: product.image_256 || null,
          // Catégorie
          category_id: product.categ_id?.[0] || null,
          category_name: product.categ_id?.[1] || null,
          // Métadonnées
          weight: product.weight,
          volume: product.volume,
          odoo_template_id: product.id, // ID du template Odoo
        },
      });
    }

    // Log first product for debugging
    if (productsToInsert.length > 0) {
      console.log('[ODOO] 🔍 First product to insert:', {
        product_name: productsToInsert[0].product_name,
        template_id: productsToInsert[0].additional_data.odoo_template_id,
        has_image_1920: !!(productsToInsert[0].additional_data as any).image_1920,
        has_description: !!productsToInsert[0].description,
        category: productsToInsert[0].additional_data.category_name,
      });
    }

    // Phase 2: Batch upsert de tous les supplier_products (1 seule requête SQL)
    console.log(`[ODOO] 📤 Upserting ${productsToInsert.length} products in batch...`);
    try {
      const { data: insertedProducts, error: insertError } = await supabaseClient
        .from('supplier_products')
        .upsert(productsToInsert, { 
          onConflict: 'user_id,supplier_id,supplier_reference',
          ignoreDuplicates: false 
        })
        .select('id, ean, purchase_price');

      if (insertError) {
        console.error('[ODOO] ❌ Batch insert error:', insertError);
        throw insertError;
      }

      imported = insertedProducts?.length || 0;
      console.log(`[ODOO] ✅ ${imported} products upserted successfully`);

      // Phase 3: Batch matching par EAN (1 SELECT + 1 UPDATE)
      const productsWithEan = insertedProducts?.filter((p: any) => p.ean) || [];
      if (productsWithEan.length > 0) {
        console.log(`[ODOO] 🔍 Matching ${productsWithEan.length} products by EAN...`);
        
        const eanList = productsWithEan.map((p: any) => p.ean);
        
        // Récupérer tous les product_analyses qui ont ces EAN (1 seule requête)
        const { data: analysesToMatch } = await supabaseClient
          .from('product_analyses')
          .select('id, ean')
          .eq('user_id', userId)
          .in('ean', eanList)
          .is('supplier_product_id', null);
        
        if (analysesToMatch && analysesToMatch.length > 0) {
          // Créer un map EAN -> supplier_product info
          const eanToProductInfo = new Map(
            productsWithEan.map((p: any) => [p.ean, { id: p.id, price: p.purchase_price }])
          );
          
          // Préparer les updates en batch
          const updates = analysesToMatch.map((analysis: any) => {
            const productInfo = eanToProductInfo.get(analysis.ean) as { id: string; price: number } | undefined;
            return {
              id: analysis.id,
              supplier_product_id: productInfo?.id ?? null,
              purchase_price: productInfo?.price ?? null,
              purchase_currency: 'EUR',
              updated_at: new Date().toISOString()
            };
          });
          
          // Batch update (1 seule requête)
          const { error: matchError } = await supabaseClient
            .from('product_analyses')
            .upsert(updates, { onConflict: 'id' });
          
          if (matchError) {
            console.error('[ODOO] ⚠️ Batch matching error:', matchError);
          } else {
            matched = updates.length;
            console.log(`[ODOO] ✅ ${matched} products matched by EAN`);
          }
        }
      }

      errors = productsToInsert.length - imported;

    } catch (err: any) {
      console.error('[ODOO] ❌ Batch operation failed:', err.message);
      errors = productsToInsert.length;
    }

    console.log(`[ODOO] ✅ Chunk complete: ${imported} imported, ${matched} matched, ${errors} errors`);

    // Log chunk upserted
    await writeLog(supabaseClient, {
      jobId: import_job_id,
      userId,
      supplierId: supplier_id,
      functionName: 'import-from-odoo',
      step: 'odoo_chunk_upserted',
      level: errors > 0 ? 'warn' : 'info',
      message: `Chunk upserted: imported=${imported}, matched=${matched}, errors=${errors}`,
      context: { imported, matched, errors, offset, limit, hasErrors: errors > 0 }
    });

    // Note: Job progress updates are now handled by process-import-chunk
    // to avoid race conditions between multiple concurrent chunks

    const hasMore = (offset + limit) < totalCount;

    // Log l'import chunk
    if (!hasMore) {
      await supabaseClient.from('supplier_import_logs').insert({
        user_id: userId,
        supplier_id: supplier_id,
        total_items: imported,
        success_items: imported,
        error_items: errors,
        import_result: { imported, matched, errors },
      });

      // Mettre à jour last_sync_at uniquement quand tous les chunks sont finis
      await supabaseClient
        .from('supplier_configurations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', supplier_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        matched, 
        errors,
        hasMore,
        nextOffset: offset + limit,
        totalCount,
        errorSample: [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: any) {
    console.error('[ODOO-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    );
  }
});
