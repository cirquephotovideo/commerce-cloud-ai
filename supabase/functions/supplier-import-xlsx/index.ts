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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    let userId = user?.id;

    if (userError || !userId) {
      try {
        const token = authHeader.replace('Bearer', '').trim();
        const payload = JSON.parse(atob(token.split('.')[1] || ''));
        userId = payload?.sub;
      } catch (e) {
        console.warn('[supplier-import-xlsx] Failed to decode JWT', e);
      }
    }

    if (!userId) {
      throw new Error('Authentication failed');
    }

    const { supplierId, filePath, skipRows = 1, columnMapping = {} } = await req.json();

    console.log('[supplier-import-xlsx] Starting import:', {
      supplier: supplierId,
      filePath,
      skipRows,
      mappedColumns: Object.keys(columnMapping).length
    });

    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('[supplier-import-xlsx] Download failed:', downloadError);
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    console.log('[supplier-import-xlsx] File loaded:', bytes.length, 'bytes');

    // Parse XLSX
    const workbook = XLSX.read(bytes, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    const dataRows = skipRows > 0 ? data.slice(skipRows) : data;

    const products = [];
    let matched = 0;
    let newProducts = 0;
    let failed = 0;

    // Process in batches to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      
      for (const row of batch) {
        try {
          // Use column mapping if provided, otherwise fallback to basic mapping
          const getName = () => {
            if (columnMapping.product_name !== null && columnMapping.product_name !== undefined) {
              return row[columnMapping.product_name];
            }
            return row[2]; // Default: column 3
          };
          
          const getPrice = () => {
            if (columnMapping.purchase_price !== null && columnMapping.purchase_price !== undefined) {
              return row[columnMapping.purchase_price];
            }
            return row[3]; // Default: column 4
          };

          const name = getName();
          const price = getPrice();

          if (!name || !price) {
            failed++;
            continue;
          }

          const productData = {
            user_id: userId,
            supplier_id: supplierId,
            ean: columnMapping.ean !== null ? String(row[columnMapping.ean] || '') : (row[0] ? String(row[0]) : null),
            supplier_reference: columnMapping.supplier_reference !== null ? String(row[columnMapping.supplier_reference] || '') : (row[1] ? String(row[1]) : null),
            product_name: String(name),
            purchase_price: parseFloat(String(price).replace(',', '.')),
            stock_quantity: columnMapping.stock_quantity !== null ? parseInt(String(row[columnMapping.stock_quantity] || 0)) : (row[4] ? parseInt(String(row[4])) : null),
            currency: 'EUR',
            description: columnMapping.description !== null ? String(row[columnMapping.description] || '') : null,
            category: columnMapping.category !== null ? String(row[columnMapping.category] || '') : null,
          };

          // Check if product exists
          const { data: existing } = await supabase
            .from('supplier_products')
            .select('id')
            .eq('supplier_id', supplierId)
            .eq('ean', productData.ean)
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
            if (productData.ean) {
              const { data: analysis } = await supabase
                .from('product_analyses')
                .select('id')
                .eq('ean', String(productData.ean))
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

            // If no match found, marked for enrichment
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
    }

    // Log the import
    await supabase.from('supplier_import_logs').insert([{
      user_id: userId,
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
