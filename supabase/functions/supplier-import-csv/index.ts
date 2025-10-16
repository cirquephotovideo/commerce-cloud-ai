import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã', '&auml;': 'ä',
    '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê', '&euml;': 'ë',
    '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î', '&iuml;': 'ï',
    '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ', '&ouml;': 'ö',
    '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û', '&uuml;': 'ü',
    '&ccedil;': 'ç', '&ntilde;': 'ñ',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&euro;': '€', '&pound;': '£', '&yen;': '¥', '&copy;': '©', '&reg;': '®',
  };
  
  return text.replace(/&[a-z]+;/gi, match => entities[match.toLowerCase()] || match);
}

// Helper to extract field with sub-field support
function extractField(columns: string[], mapping: any): string | null {
  if (!mapping) return null;
  
  // Simple column index
  if (typeof mapping === 'number') {
    return columns[mapping] || null;
  }
  
  // Object with col/sub support
  if (typeof mapping === 'object' && mapping.col !== undefined) {
    const cellValue = columns[mapping.col] || '';
    
    // If no sub-field, return whole cell
    if (mapping.sub === undefined) {
      return cellValue.trim();
    }
    
    // Extract sub-field
    const subDelimiter = mapping.subDelimiter || ',';
    const subFields = cellValue.split(subDelimiter).map(s => s.trim());
    return subFields[mapping.sub] || null;
  }
  
  return null;
}

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

    const { supplierId, fileContent, delimiter: userDelimiter, skipRows = 1, columnMapping = {} } = await req.json();

    console.log('[CSV-IMPORT] Starting for supplier:', supplierId);
    console.log('[CSV-IMPORT] Skip rows:', skipRows);
    console.log('[CSV-IMPORT] User delimiter:', userDelimiter);
    
    // Whitelist of supported fields
    const supportedFields = ['product_name', 'supplier_reference', 'ean', 'purchase_price', 'stock_quantity'];
    const mappingFields = Object.keys(columnMapping);
    const unsupportedFields = mappingFields.filter(field => !supportedFields.includes(field));
    
    if (unsupportedFields.length > 0) {
      console.log('[CSV-IMPORT] ⚠️ Ignoring unsupported fields:', unsupportedFields.join(', '));
    }
    
    console.log('[CSV-IMPORT] Using fields:', mappingFields.filter(field => supportedFields.includes(field)).join(', '));
    console.log('[CSV-IMPORT] Column mapping:', JSON.stringify(columnMapping, null, 2));

    // Remove BOM if present
    const cleanContent = fileContent.replace(/^\uFEFF/, '');
    const lines = cleanContent.split(/\r?\n/).filter((line: string) => line.trim());
    
    console.log(`[CSV-IMPORT] Total lines: ${lines.length}`);

    // Auto-detect delimiter if not specified
    let delimiter = userDelimiter || ';';
    if (lines.length > 0) {
      const firstLine = lines[0];
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      
      if (commaCount > 3 && commaCount > semicolonCount) {
        delimiter = ',';
        console.log(`[CSV-IMPORT] Auto-detected delimiter: "," (${commaCount} commas vs ${semicolonCount} semicolons)`);
      } else {
        console.log(`[CSV-IMPORT] Using delimiter: "${delimiter}"`);
      }
    }

    // Log first 3 lines
    console.log('[CSV-IMPORT] First 3 lines:');
    lines.slice(0, 3).forEach((line: string, i: number) => {
      console.log(`  Line ${i}: ${line.substring(0, 300)}`);
    });

    const startIndex = skipRows;
    const dataLines = lines.slice(startIndex);
    console.log(`[CSV-IMPORT] Processing ${dataLines.length} data lines (after skipping ${skipRows})`);

    let matched = 0;
    let newProducts = 0;
    let failed = 0;
    let skippedEmpty = 0;
    let skippedNoRef = 0;
    let skippedNoPrice = 0;
    let dbErrors = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) {
        skippedEmpty++;
        continue;
      }

      try {
        // Split by delimiter and clean quotes
        const columns = line.split(delimiter).map((col: string) => 
          col.trim().replace(/^["']|["']$/g, '')
        );

        // Extract fields using advanced mapping
        const productName = extractField(columns, columnMapping?.product_name) || columns[0] || '';
        const supplierRef = extractField(columns, columnMapping?.supplier_reference) || columns[1] || '';
        const ean = extractField(columns, columnMapping?.ean) || (columns[2] || null);
        
        // Extract price with decimal handling
        let purchasePrice: number | null = null;
        const priceMapping = columnMapping?.purchase_price;
        const priceStr = extractField(columns, priceMapping);
        
        if (priceStr) {
          const decimalSep = (priceMapping && typeof priceMapping === 'object') 
            ? priceMapping.decimal || ',' 
            : ',';
          const normalizedPrice = priceStr.replace(decimalSep, '.');
          const parsed = parseFloat(normalizedPrice);
          if (!isNaN(parsed) && parsed > 0) {
            purchasePrice = parsed;
          }
        }
        
        // Extract stock
        let stockQuantity: number | null = null;
        const stockStr = extractField(columns, columnMapping?.stock_quantity);
        if (stockStr) {
          const parsed = parseInt(stockStr);
          if (!isNaN(parsed)) {
            stockQuantity = parsed;
          }
        }

        // Validation with detailed logging
        if (!supplierRef) {
          skippedNoRef++;
          if (i < 5) {
            console.log(`[CSV-IMPORT] Line ${i}: Missing supplier reference`);
          }
          failed++;
          continue;
        }

        if (!purchasePrice) {
          skippedNoPrice++;
          if (i < 5) {
            console.log(`[CSV-IMPORT] Line ${i}: Missing or invalid price (ref: ${supplierRef})`);
          }
          failed++;
          continue;
        }

        // Log first few parsed products
        if (i < 3) {
          console.log(`[CSV-IMPORT] Sample product ${i + 1}:`, {
            name: productName,
            ref: supplierRef,
            ean: ean,
            price: purchasePrice,
            stock: stockQuantity
          });
        }

        // Decode HTML entities
        const cleanName = decodeHtmlEntities(productName || supplierRef);

        const productData = {
          user_id: user.id,
          supplier_id: supplierId,
          supplier_reference: supplierRef,
          product_name: cleanName,
          ean: ean,
          purchase_price: purchasePrice,
          stock_quantity: stockQuantity,
          currency: 'EUR',
          needs_enrichment: true,
        };

        // Check if product exists by supplier_reference
        const { data: existing } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('supplier_reference', supplierRef)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('supplier_products')
            .update({
              product_name: productData.product_name,
              ean: productData.ean,
              purchase_price: productData.purchase_price,
              stock_quantity: productData.stock_quantity,
              last_updated: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('[CSV-IMPORT] Update error:', updateError);
            dbErrors++;
            failed++;
          } else {
            matched++;
          }
        } else {
          // Insert new
          const { data: newProduct, error: insertError } = await supabase
            .from('supplier_products')
            .insert([productData])
            .select()
            .single();

          if (insertError) {
            console.error('[CSV-IMPORT] Insert error:', insertError);
            dbErrors++;
            failed++;
            continue;
          }

          // Try to match with existing product_analyses by EAN
          let matchedAnalysis = false;
          if (productData.ean) {
            const { data: analysis } = await supabase
              .from('product_analyses')
              .select('id')
              .eq('ean', productData.ean)
              .maybeSingle();

            if (analysis) {
              await supabase
                .from('product_analyses')
                .update({
                  purchase_price: productData.purchase_price,
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

          // If no EAN match, create new product_analyses automatically
          if (!matchedAnalysis) {
            const { data: newAnalysis, error: analysisError } = await supabase
              .from('product_analyses')
              .insert({
                user_id: user.id,
                ean: productData.ean,
                purchase_price: productData.purchase_price,
                purchase_currency: 'EUR',
                supplier_product_id: newProduct.id,
                analysis_result: {
                  name: cleanName,
                },
                needs_enrichment: true
              })
              .select('id')
              .single();

            if (!analysisError && newAnalysis) {
              // Create enrichment queue entry
              await supabase
                .from('enrichment_queue')
                .insert({
                  user_id: user.id,
                  analysis_id: newAnalysis.id,
                  supplier_product_id: newProduct.id,
                  enrichment_type: ['specifications', 'description'],
                  priority: 'normal',
                  status: 'pending'
                });

              console.log('[CSV-IMPORT] Created product_analyses and enrichment_queue for new product:', {
                supplier_product_id: newProduct.id,
                analysis_id: newAnalysis.id
              });
            }
          }

          newProducts++;
        }
      } catch (error) {
        console.error(`[CSV-IMPORT] Error processing line ${i}:`, error);
        dbErrors++;
        failed++;
      }
    }

    console.log('[CSV-IMPORT] Summary:', {
      total: dataLines.length,
      newProducts,
      matched,
      failed,
      skippedEmpty,
      skippedNoRef,
      skippedNoPrice,
      dbErrors
    });

    // Log the import
    await supabase.from('supplier_import_logs').insert([{
      user_id: user.id,
      supplier_id: supplierId,
      import_type: 'manual',
      source_file: 'csv_upload',
      products_found: dataLines.length,
      products_matched: matched,
      products_new: newProducts,
      products_updated: matched,
      products_failed: failed,
      import_status: failed === 0 ? 'success' : failed < dataLines.length ? 'partial' : 'failed',
    }]);

    // Update supplier last sync
    await supabase
      .from('supplier_configurations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', supplierId);

    return new Response(
      JSON.stringify({
        success: true,
        imported: newProducts + matched,
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
