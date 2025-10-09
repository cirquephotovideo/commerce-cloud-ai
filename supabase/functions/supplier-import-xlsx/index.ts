import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    const { supplierId, fileContent, skipFirstRow = true } = await req.json();

    console.log('Starting XLSX import for supplier:', supplierId);

    // Decode base64 content
    const binaryString = atob(fileContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse XLSX
    const workbook = XLSX.read(bytes, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    const dataRows = skipFirstRow ? data.slice(1) : data;

    const products = [];
    let matched = 0;
    let newProducts = 0;
    let failed = 0;

    for (const row of dataRows) {
      try {
        // Basic mapping - can be made configurable later
        const [ean, reference, name, price, stock] = row;

        if (!name || !price) {
          failed++;
          continue;
        }

        const productData = {
          user_id: user.id,
          supplier_id: supplierId,
          ean: ean ? String(ean) : null,
          supplier_reference: reference ? String(reference) : null,
          product_name: String(name),
          purchase_price: parseFloat(String(price).replace(',', '.')),
          stock_quantity: stock ? parseInt(String(stock)) : null,
          currency: 'EUR',
        };

        // Check if product exists
        const { data: existing } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('ean', ean)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('supplier_products')
            .update({ ...productData, enrichment_status: 'completed', enrichment_progress: 100 })
            .eq('id', existing.id);
          matched++;
        } else {
          // Insert new
          const { data: newProduct, error: insertError } = await supabase
            .from('supplier_products')
            .insert([productData])
            .select()
            .single();

          if (insertError) throw insertError;

          // Try to match with existing product_analyses by EAN
          let matchedAnalysis = false;
          if (ean) {
            const { data: analysis } = await supabase
              .from('product_analyses')
              .select('id')
              .eq('ean', String(ean))
              .maybeSingle();

            if (analysis) {
              await supabase
                .from('product_analyses')
                .update({
                  purchase_price: parseFloat(String(price).replace(',', '.')),
                  purchase_currency: 'EUR',
                  supplier_product_id: newProduct.id,
                })
                .eq('id', analysis.id);
              
              await supabase
                .from('supplier_products')
                .update({ enrichment_status: 'completed', enrichment_progress: 100 })
                .eq('id', newProduct.id);
              
              matchedAnalysis = true;
            }
          }

          // If no match found, marked for enrichment (handled by process-pending-enrichments)
          if (!matchedAnalysis) {
            console.log(`🔍 Product ${name} marked for enrichment`);
          }

          newProducts++;
        }

        products.push(productData);
      } catch (error) {
        console.error('Error processing row:', error);
        failed++;
      }
    }

    // Log the import
    await supabase.from('supplier_import_logs').insert([{
      user_id: user.id,
      supplier_id: supplierId,
      import_type: 'manual',
      source_file: 'xlsx_upload',
      products_found: dataRows.length,
      products_matched: matched,
      products_new: newProducts,
      products_updated: matched,
      products_failed: failed,
      import_status: failed === 0 ? 'success' : failed < dataRows.length ? 'partial' : 'failed',
    }]);

    // Update supplier last sync
    await supabase
      .from('supplier_configurations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', supplierId);

    return new Response(
      JSON.stringify({
        success: true,
        imported: products.length,
        matched,
        newProducts,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
