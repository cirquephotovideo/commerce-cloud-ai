import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { ZipReader, BlobReader, BlobWriter } from "https://deno.land/x/zipjs@v2.7.34/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inbox_id, user_id } = await req.json();
    console.log('[PROCESS-ATTACHMENT] Starting:', {
      inbox_id,
      user_id,
      timestamp: new Date().toISOString()
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Fetch inbox entry first to get existing logs
    const { data: inbox, error: inboxError } = await supabase
      .from('email_inbox')
      .select('*')
      .eq('id', inbox_id)
      .single();

    if (inboxError || !inbox) {
      throw new Error('Inbox entry not found');
    }

    console.log('[PROCESS-ATTACHMENT] Email details:', {
      attachment_name: inbox.attachment_name,
      attachment_type: inbox.attachment_type,
      attachment_size_kb: inbox.attachment_size_kb,
      from: inbox.from_email
    });

    // Update status to processing
    const processingLogs = [...(inbox.processing_logs || []), {
      timestamp: new Date().toISOString(),
      message: 'Processing started',
      attachment: inbox.attachment_name
    }];

    await supabase
      .from('email_inbox')
      .update({ 
        status: 'processing',
        processing_logs: processingLogs
      })
      .eq('id', inbox_id);

    // Download file from storage using FULL PATH
    console.log('[PROCESS-ATTACHMENT] Downloading from Storage:', inbox.attachment_url);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('email-attachments')
      .download(inbox.attachment_url); // Use full path, not just filename

    if (downloadError) {
      throw downloadError;
    }

    const fileBuffer = await fileData.arrayBuffer();
    console.log('[PROCESS-ATTACHMENT] File downloaded:', {
      size_bytes: fileBuffer.byteLength,
      size_mb: (fileBuffer.byteLength / 1024 / 1024).toFixed(2)
    });

    // === ZIP DECOMPRESSION LOGIC ===
    let processBuffer = fileBuffer;
    let processFileName = inbox.attachment_name;
    let originalArchive: string | null = null;

    if (inbox.attachment_name?.endsWith('.zip')) {
      console.log('[PROCESS-ATTACHMENT] ZIP file detected - starting decompression');
      
      await supabase
        .from('email_inbox')
        .update({
          processing_logs: [...processingLogs, {
            timestamp: new Date().toISOString(),
            message: 'ZIP archive detected - decompressing...'
          }]
        })
        .eq('id', inbox_id);
      
      try {
        const zipReader = new ZipReader(new BlobReader(new Blob([fileBuffer])));
        const entries = await zipReader.getEntries();
        
        console.log(`[PROCESS-ATTACHMENT] ZIP contains ${entries.length} file(s):`, entries.map((e: any) => e.filename));
        
        // Find first CSV/XLSX/XLS file
        const targetEntry = entries.find((e: any) => 
          e.filename.match(/\.(csv|xlsx|xls)$/i) && !e.directory
        );
        
        if (!targetEntry || !targetEntry.getData) {
          throw new Error('No CSV/XLSX/XLS file found in ZIP archive');
        }
        
        console.log(`[PROCESS-ATTACHMENT] Extracting: ${targetEntry.filename}`);
        
        // Extract content
        const writer = new BlobWriter();
        await targetEntry.getData(writer);
        const extractedBlob = await writer.getData();
        processBuffer = await extractedBlob.arrayBuffer();
        originalArchive = processFileName;
        processFileName = targetEntry.filename;
        
        await zipReader.close();
        
        console.log('[PROCESS-ATTACHMENT] Extracted file:', {
          original: inbox.attachment_name,
          extracted: processFileName,
          size_bytes: processBuffer.byteLength,
          size_mb: (processBuffer.byteLength / 1024 / 1024).toFixed(2)
        });
        
        processingLogs.push({
          timestamp: new Date().toISOString(),
          message: `Extracted ${processFileName} from ZIP`,
          size_mb: (processBuffer.byteLength / 1024 / 1024).toFixed(2)
        });
        
      } catch (zipError: any) {
        console.error('[PROCESS-ATTACHMENT] ZIP extraction failed:', zipError);
        throw new Error(`Failed to decompress ZIP: ${zipError.message}`);
      }
    }
    // === END ZIP DECOMPRESSION ===

    // Parse file (support CSV, XLSX, XLS)
    let rows: any[] = [];
    
    if (processFileName?.includes('.csv') || processFileName?.endsWith('.csv')) {
      const text = new TextDecoder().decode(processBuffer);
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(/[,;]/);
      rows = lines.slice(1).map(line => {
        const values = line.split(/[,;]/);
        const row: any = {};
        headers.forEach((h, i) => row[h.trim()] = values[i]?.trim());
        return row;
      });
    } else if (processFileName?.match(/\.(xlsx|xls)$/)) {
      const workbook = XLSX.read(processBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet);
    } else {
      throw new Error(`Unsupported file type: ${processFileName}`);
    }

    console.log('[PROCESS-ATTACHMENT] File parsed successfully:', {
      format: processFileName.endsWith('.csv') ? 'CSV' : 'Excel',
      rows_found: rows.length,
      columns: Object.keys(rows[0] || {}).length,
      sample_columns: Object.keys(rows[0] || {}).slice(0, 5)
    });
    
    if (originalArchive) {
      console.log('[PROCESS-ATTACHMENT] Original archive:', originalArchive);
    }

    processingLogs.push({
      timestamp: new Date().toISOString(),
      message: `Parsed ${rows.length} rows from ${processFileName}`,
      format: processFileName.endsWith('.csv') ? 'CSV' : 'Excel',
      columns: Object.keys(rows[0] || {}).length
    });

    await supabase
      .from('email_inbox')
      .update({ processing_logs: processingLogs })
      .eq('id', inbox_id);

    // Check if supplier has saved column mapping
    let columnMapping: any = {};
    
    const { data: supplierConfig } = await supabase
      .from('supplier_configurations')
      .select('column_mapping')
      .eq('id', inbox.supplier_id)
      .single();

    if (supplierConfig?.column_mapping) {
      console.log('[PROCESS-ATTACHMENT] Using saved column mapping:', supplierConfig.column_mapping);
      columnMapping = supplierConfig.column_mapping;
      
      processingLogs.push({
        timestamp: new Date().toISOString(),
        message: 'Using saved column mapping',
        mapping: columnMapping
      });

      await supabase
        .from('email_inbox')
        .update({ processing_logs: processingLogs })
        .eq('id', inbox_id);
    } else {
      // Detect column mapping with AI
      const sampleRow = rows[0];
      const columnMappingPrompt = `Analyse cette ligne de fichier fournisseur et identifie les colonnes correspondantes.

Colonnes disponibles: ${Object.keys(sampleRow).join(', ')}
Exemple de valeurs: ${JSON.stringify(sampleRow, null, 2)}

Réponds UNIQUEMENT en JSON valide:
{
  "product_name": "nom-colonne-ou-null",
  "ean": "nom-colonne-ou-null",
  "supplier_reference": "nom-colonne-ou-null",
  "purchase_price": "nom-colonne-ou-null",
  "stock_quantity": "nom-colonne-ou-null",
  "brand": "nom-colonne-ou-null"
}`;

      console.log('[PROCESS-ATTACHMENT] Starting AI column mapping detection...');
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Tu réponds uniquement en JSON valide.' },
              { role: 'user', content: columnMappingPrompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '{}';
          columnMapping = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          console.log('[PROCESS-ATTACHMENT] Column mapping detected:', columnMapping);
          
          processingLogs.push({
            timestamp: new Date().toISOString(),
            message: 'Column mapping detected by AI',
            mapping: columnMapping
          });

          await supabase
            .from('email_inbox')
            .update({ processing_logs: processingLogs })
            .eq('id', inbox_id);

          // Save detected mapping to supplier configuration
          await supabase
            .from('supplier_configurations')
            .update({ column_mapping: columnMapping })
            .eq('id', inbox.supplier_id);

          console.log('[PROCESS-ATTACHMENT] Column mapping saved to supplier configuration');
        }
      } catch (e) {
        console.error('[PROCESS-ATTACHMENT] Mapping AI failed:', e);
        processingLogs.push({
          timestamp: new Date().toISOString(),
          message: 'AI mapping failed - using manual detection',
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    // Process each row
    let productsCreated = 0;
    let productsUpdated = 0;
    let productsFound = 0;
    const updatedVariantIds: string[] = []; // Track variant IDs for price alerts

    for (const row of rows.slice(0, 100)) { // Limit to 100 for performance
      try {
        const normalizedRow = {
          product_name: row[columnMapping.product_name] || '',
          ean: row[columnMapping.ean] || '',
          supplier_reference: row[columnMapping.supplier_reference] || '',
          purchase_price: parseFloat(row[columnMapping.purchase_price] || '0'),
          stock_quantity: parseInt(row[columnMapping.stock_quantity] || '0'),
          brand: row[columnMapping.brand] || '',
        };

        if (!normalizedRow.product_name && !normalizedRow.ean && !normalizedRow.supplier_reference) {
          continue;
        }

        productsFound++;

        // 1. Match by EAN
        let matchedAnalysis = null;
        let matchType = '';
        let matchConfidence = 0;

        if (normalizedRow.ean) {
          const { data: eanMatch } = await supabase
            .from('product_analyses')
            .select('id, ean, analysis_result')
            .eq('user_id', user_id)
            .eq('ean', normalizedRow.ean)
            .maybeSingle();

          if (eanMatch) {
            matchedAnalysis = eanMatch;
            matchType = 'ean';
            matchConfidence = 100;
          }
        }

        // 2. Match by supplier reference
        if (!matchedAnalysis && normalizedRow.supplier_reference && inbox.supplier_id) {
          const { data: refMatch } = await supabase
            .from('supplier_products')
            .select('id, product_links!inner(analysis_id)')
            .eq('user_id', user_id)
            .eq('supplier_id', inbox.supplier_id)
            .eq('supplier_reference', normalizedRow.supplier_reference)
            .maybeSingle();

          if (refMatch?.product_links) {
            const { data: analysis } = await supabase
              .from('product_analyses')
              .select('id, ean, analysis_result')
              .eq('id', (refMatch.product_links as any).analysis_id)
              .single();

            if (analysis) {
              matchedAnalysis = analysis;
              matchType = 'reference';
              matchConfidence = 95;
            }
          }
        }

        // 3. Match by name similarity (simplified, no AI for performance)
        if (!matchedAnalysis && normalizedRow.product_name) {
          const { data: allProducts } = await supabase
            .from('product_analyses')
            .select('id, ean, analysis_result')
            .eq('user_id', user_id)
            .limit(50);

          // Simple string similarity
          for (const product of allProducts || []) {
            const analysisName = (product.analysis_result as any)?.name || '';
            const similarity = calculateSimilarity(normalizedRow.product_name, analysisName);
            if (similarity > 0.75) {
              matchedAnalysis = product;
              matchType = 'name';
              matchConfidence = Math.round(similarity * 100);
              break;
            }
          }
        }

        if (matchedAnalysis && inbox.supplier_id) {
          // Update or create supplier_price_variants
          const { data: variant, error: upsertError } = await supabase
            .from('supplier_price_variants')
            .upsert({
              analysis_id: matchedAnalysis.id,
              supplier_id: inbox.supplier_id,
              user_id: user_id,
              supplier_reference: normalizedRow.supplier_reference,
              purchase_price: normalizedRow.purchase_price,
              stock_quantity: normalizedRow.stock_quantity,
              match_type: matchType,
              match_confidence: matchConfidence,
              last_updated: new Date().toISOString(),
              product_name: normalizedRow.product_name,
            }, {
              onConflict: 'analysis_id,supplier_id'
            })
            .select('id')
            .single();

          if (!upsertError && variant) {
            updatedVariantIds.push(variant.id);
            productsUpdated++;
          }
        } else if (inbox.supplier_id) {
          // Create new supplier_product
          const { error: insertError } = await supabase
            .from('supplier_products')
            .insert({
              user_id: user_id,
              supplier_id: inbox.supplier_id,
              product_name: normalizedRow.product_name,
              ean: normalizedRow.ean,
              supplier_reference: normalizedRow.supplier_reference,
              purchase_price: normalizedRow.purchase_price,
              stock_quantity: normalizedRow.stock_quantity,
              additional_data: { brand: normalizedRow.brand },
            });

          if (!insertError) {
            productsCreated++;
          }
        }
      } catch (rowError) {
        console.error('[PROCESS-ATTACHMENT] Row processing error:', rowError);
      }
    }

    // Update inbox entry with results
    processingLogs.push({
      timestamp: new Date().toISOString(),
      message: 'Processing completed successfully',
      summary: {
        products_found: productsFound,
        products_updated: productsUpdated,
        products_created: productsCreated
      }
    });

    await supabase
      .from('email_inbox')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        products_found: productsFound,
        products_updated: productsUpdated,
        products_created: productsCreated,
        processing_logs: processingLogs
      })
      .eq('id', inbox_id);

    // Check for price variations and create alerts
    console.log('[PROCESS-ATTACHMENT] Checking for price variations...');
    
    for (const variantId of updatedVariantIds) {
      const { data: variant } = await supabase
        .from('supplier_price_variants')
        .select('*, supplier_configurations(supplier_name)')
        .eq('id', variantId)
        .single();
      
      if (variant?.price_history && Array.isArray(variant.price_history)) {
        const history = variant.price_history;
        if (history.length > 0) {
          const lastChange = history[history.length - 1];
          const variationPct = Math.abs(lastChange.variation_pct || 0);
          
          // Create alert if variation > 10%
          if (variationPct > 10) {
            await supabase.from('user_alerts').insert({
              user_id: user_id,
              alert_type: 'price_variation',
              severity: lastChange.variation_pct > 0 ? 'warning' : 'info',
              title: `Variation de prix importante (${lastChange.variation_pct > 0 ? '+' : ''}${lastChange.variation_pct}%)`,
              message: `Le fournisseur ${variant.supplier_configurations?.supplier_name || 'Inconnu'} a modifié le prix de ${lastChange.old_price}€ à ${lastChange.new_price}€ pour le produit ${variant.product_name}`,
              product_id: variant.analysis_id,
              is_read: false,
            });
            
            console.log('[PROCESS-ATTACHMENT] Alert created for price variation:', {
              supplier: variant.supplier_configurations?.supplier_name,
              variation: lastChange.variation_pct
            });
          }
        }
      }
    }

    console.log('[PROCESS-ATTACHMENT] Completed:', { productsFound, productsUpdated, productsCreated });

    return new Response(JSON.stringify({ 
      success: true,
      products_found: productsFound,
      products_updated: productsUpdated,
      products_created: productsCreated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[PROCESS-ATTACHMENT] Error:', error);
    
    // Update inbox with error
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { inbox_id } = await req.json().catch(() => ({}));
    if (inbox_id) {
      await supabase
        .from('email_inbox')
        .update({
          status: 'failed',
          error_message: error.message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', inbox_id);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.includes(shorter)) return 0.8;
  
  // Levenshtein distance (simplified)
  const matrix: number[][] = [];
  for (let i = 0; i <= longer.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= shorter.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++) {
      if (longer[i - 1] === shorter[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[longer.length][shorter.length];
  return 1 - distance / longer.length;
}
