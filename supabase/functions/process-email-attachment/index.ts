import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const { inbox_id, user_id } = await req.json();
    console.log('[PROCESS-ATTACHMENT] Starting for inbox:', inbox_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Update status to processing
    await supabase
      .from('email_inbox')
      .update({ status: 'processing', processing_logs: [{ timestamp: new Date().toISOString(), message: 'Starting processing' }] })
      .eq('id', inbox_id);

    // Fetch inbox entry
    const { data: inbox, error: inboxError } = await supabase
      .from('email_inbox')
      .select('*')
      .eq('id', inbox_id)
      .single();

    if (inboxError || !inbox) {
      throw new Error('Inbox entry not found');
    }

    // Download file from storage
    const fileName = inbox.attachment_url.split('/').pop();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('email-attachments')
      .download(fileName);

    if (downloadError) {
      throw downloadError;
    }

    const fileBuffer = await fileData.arrayBuffer();
    console.log('[PROCESS-ATTACHMENT] Downloaded file, size:', fileBuffer.byteLength);

    // Parse file (support CSV, XLSX)
    let rows: any[] = [];
    
    if (inbox.attachment_type?.includes('csv') || inbox.attachment_name?.endsWith('.csv')) {
      const text = new TextDecoder().decode(fileBuffer);
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(/[,;]/);
      rows = lines.slice(1).map(line => {
        const values = line.split(/[,;]/);
        const row: any = {};
        headers.forEach((h, i) => row[h.trim()] = values[i]?.trim());
        return row;
      });
    } else if (inbox.attachment_name?.match(/\.(xlsx|xls)$/)) {
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet);
    } else {
      throw new Error('Unsupported file type');
    }

    console.log('[PROCESS-ATTACHMENT] Parsed', rows.length, 'rows');

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

    let columnMapping: any = {};
    
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
        console.log('[PROCESS-ATTACHMENT] Column mapping:', columnMapping);
      }
    } catch (e) {
      console.error('[PROCESS-ATTACHMENT] Mapping AI failed:', e);
    }

    // Process each row
    let productsCreated = 0;
    let productsUpdated = 0;
    let productsFound = 0;

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
          const { error: upsertError } = await supabase
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
            }, {
              onConflict: 'analysis_id,supplier_id'
            });

          if (!upsertError) {
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
    await supabase
      .from('email_inbox')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        products_found: productsFound,
        products_updated: productsUpdated,
        products_created: productsCreated,
      })
      .eq('id', inbox_id);

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
