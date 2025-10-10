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

    const { supplierId, fileContent, delimiter = ';', skipRows = 1, columnMapping = {} } = await req.json();

    console.log('Starting CSV import for supplier:', supplierId, 'skipping', skipRows, 'rows');

    // Parse CSV
    const lines = fileContent.split('\n').filter((line: string) => line.trim());
    const dataLines = skipRows > 0 ? lines.slice(skipRows) : lines;

    const products = [];
    let matched = 0;
    let newProducts = 0;
    let failed = 0;

    for (const line of dataLines) {
      try {
        const columns = line.split(delimiter).map((col: string) => col.trim());
        
        // Use column mapping if provided
        const getName = () => {
          if (columnMapping.product_name !== null && columnMapping.product_name !== undefined) {
            return columns[columnMapping.product_name];
          }
          return columns[2]; // Default: column 3
        };
        
        const getPrice = () => {
          if (columnMapping.purchase_price !== null && columnMapping.purchase_price !== undefined) {
            return columns[columnMapping.purchase_price];
          }
          return columns[3]; // Default: column 4
        };

        const name = getName();
        const price = getPrice();

        if (!name || !price) {
          failed++;
          continue;
        }

        // Decode HTML entities and clean description
        const descriptionValue = columnMapping.description !== null ? columns[columnMapping.description] : (columns[5] || null);
        const cleanDescription = descriptionValue ? decodeHtmlEntities(descriptionValue) : null;
        const isDescriptionTruncated = cleanDescription && (
          cleanDescription.endsWith('...') || 
          cleanDescription.includes('jusqu&') ||
          cleanDescription.length < 50
        );

        const productData = {
          user_id: user.id,
          supplier_id: supplierId,
          ean: columnMapping.ean !== null ? (columns[columnMapping.ean] || null) : (columns[0] || null),
          supplier_reference: columnMapping.supplier_reference !== null ? (columns[columnMapping.supplier_reference] || null) : (columns[1] || null),
          product_name: decodeHtmlEntities(name),
          purchase_price: parseFloat(String(price).replace(',', '.')),
          stock_quantity: columnMapping.stock_quantity !== null ? (columns[columnMapping.stock_quantity] ? parseInt(columns[columnMapping.stock_quantity]) : null) : (columns[4] ? parseInt(columns[4]) : null),
          currency: 'EUR',
          description: cleanDescription,
          needs_enrichment: isDescriptionTruncated,
          brand: columnMapping.brand !== null ? (columns[columnMapping.brand] || null) : null,
          category: columnMapping.category !== null ? (columns[columnMapping.category] || null) : null,
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

          // If no match found, trigger auto-enrichment
          if (!matchedAnalysis) {
            console.log(`🔍 Product ${productData.product_name} not found, marking for enrichment...`);
            // The process-pending-enrichments function will handle this
          }

          newProducts++;
        }

        products.push(productData);
      } catch (error) {
        console.error('Error processing line:', error);
        failed++;
      }
    }

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
