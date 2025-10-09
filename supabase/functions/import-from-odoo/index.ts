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

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Authentification Odoo XML-RPC
    const database = config.additional_config?.database || 'odoo';
    const username = config.additional_config?.username;
    const password = config.additional_config?.password;

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

    const authResponse = await fetch(`${config.platform_url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authPayload,
    });

    const authText = await authResponse.text();
    const uidMatch = authText.match(/<int>(\d+)<\/int>/);
    if (!uidMatch) {
      throw new Error('Odoo authentication failed');
    }
    const uid = parseInt(uidMatch[1]);

    console.log('Odoo authenticated with UID:', uid);

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

    const productsResponse = await fetch(`${config.platform_url}/xmlrpc/2/object`, {
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
            user_id: user.id,
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
            .eq('user_id', user.id)
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
      user_id: user.id,
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
