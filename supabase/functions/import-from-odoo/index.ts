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

    // Determine which key to use based on auth context
    const authHeader = req.headers.get('Authorization');
    let supabaseKey: string;
    let userId: string;

    if (authHeader) {
      // UI call: use ANON_KEY to validate user token
      supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      console.log('Using ANON_KEY for UI authentication');
    } else {
      // Auto-sync call: use SERVICE_ROLE_KEY
      supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      console.log('Using SERVICE_ROLE_KEY for auto-sync');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseKey
    );

    // Get user ID based on context
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        console.error('Authentication error:', authError);
        throw new Error('Unauthorized');
      }
      
      userId = user.id;
      console.log('Authenticated user:', userId);
    } else {
      // Get user_id from supplier configuration (for scheduled imports)
      const { data: supplier, error: supplierError } = await supabaseClient
        .from('supplier_configurations')
        .select('user_id')
        .eq('id', supplier_id)
        .single();

      if (supplierError || !supplier) {
        console.error('Supplier lookup error:', supplierError);
        throw new Error('Supplier not found');
      }

      userId = supplier.user_id;
      console.log('Using supplier user_id:', userId);
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

    // 1. Authenticate with Odoo XML-RPC
    const database = odooConfig.additional_config?.database || 'odoo';
    const username = odooConfig.additional_config?.username;
    const password = odooConfig.additional_config?.password;
    const odooUrl = odooConfig.platform_url;

    console.log('Odoo connection details:', { odooUrl, database, username: username ? '***' : 'missing' });

    if (!username || !password) {
      throw new Error('Odoo credentials missing in platform configuration');
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

    console.log('Authenticating with Odoo...');
    const authResponse = await fetch(`${odooUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authPayload,
    });

    if (!authResponse.ok) {
      console.error('Odoo auth response status:', authResponse.status);
      const errorText = await authResponse.text();
      console.error('Odoo auth error response:', errorText);
      throw new Error(`Odoo authentication failed: ${authResponse.status} - ${errorText.substring(0, 200)}`);
    }

    const authText = await authResponse.text();
    console.log('Odoo auth response sample:', authText.substring(0, 200));
    
    const uidMatch = authText.match(/<int>(\d+)<\/int>/);
    if (!uidMatch) {
      console.error('Failed to parse UID from response:', authText.substring(0, 500));
      throw new Error('Odoo authentication failed - could not extract UID');
    }
    const uid = parseInt(uidMatch[1]);

    console.log('Odoo authenticated successfully with UID:', uid);

    // 2. Rechercher produits avec prix d'achat
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
                  <value><string>standard_price</string></value>
                  <value><string>!=</string></value>
                  <value><double>0</double></value>
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
                <value><int>500</int></value>
              </member>
            </struct>
          </param>
        </params>
      </methodCall>`;

    const productsResponse = await fetch(`${odooConfig.platform_url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: searchPayload,
    });

    const productsXML = await productsResponse.text();
    
    // Parser XML simplifié
    const products: any[] = [];
    const structRegex = /<member>[\s\S]*?<\/member>/g;
    
    // Extraction simplifiée des produits (à améliorer avec un vrai parser XML)
    const productMatches = productsXML.match(/<struct>[\s\S]*?<\/struct>/g) || [];
    
    for (const structMatch of productMatches.slice(0, 100)) { // Limiter à 100 produits
      const extractValue = (key: string) => {
        const regex = new RegExp(`<name>${key}</name>\\s*<value>(?:<[^>]+>)?([^<]*)(?:<\/[^>]+>)?<\/value>`, 's');
        const m = structMatch.match(regex);
        return m ? m[1].trim() : null;
      };

      const product = {
        default_code: extractValue('default_code'),
        barcode: extractValue('barcode'),
        name: extractValue('name'),
        standard_price: parseFloat(extractValue('standard_price') || '0'),
        lst_price: parseFloat(extractValue('lst_price') || '0'),
        qty_available: parseInt(extractValue('qty_available') || '0'),
      };

      if (product.name) {
        products.push(product);
      }
    }

    console.log(`Found ${products.length} products from Odoo`);

    // 3. Importer dans supplier_products
    let imported = 0, matched = 0, errors = 0;
    const errorDetails = [];

    for (const product of products) {
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
      products_count: products.length,
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
