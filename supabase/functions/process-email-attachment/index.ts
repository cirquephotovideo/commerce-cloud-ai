import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { ZipReader, BlobReader, BlobWriter } from "https://deno.land/x/zipjs@v2.7.34/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FVS-specific mapping helpers (inline to avoid imports)
function normalizeFVSHeader(header: any): string {
  if (!header) return '';
  return String(header)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeFVSPrice(value: any): number | null {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();
  if (str === 'NC' || str === '—' || str === '-' || str === 'N/A') return null;
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function normalizeFVSStock(qtyValue: any, statusValue?: any): number | null {
  if (qtyValue !== null && qtyValue !== undefined && qtyValue !== '') {
    const qtyStr = String(qtyValue).trim().toLowerCase();
    if (qtyStr === 'non disponible' || qtyStr === 'indisponible' || qtyStr === 'nc') return 0;
    if (qtyStr === 'disponible' || qtyStr === 'en stock') return 1;
    const num = parseInt(qtyStr.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) return num;
  }
  if (statusValue) {
    const statusStr = String(statusValue).trim().toLowerCase();
    if (statusStr.includes('disponible') && !statusStr.includes('non')) return 1;
    if (statusStr.includes('non disponible') || statusStr.includes('indisponible')) return 0;
  }
  return null;
}

function isValidEAN13(ean: string): boolean {
  if (!ean || !/^\d{13}$/.test(ean)) return false;
  const digits = ean.split('').map(Number);
  const checksum = digits[12];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const calculatedChecksum = (10 - (sum % 10)) % 10;
  return checksum === calculatedChecksum;
}

function normalizeFVSEAN(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim().replace(/\s/g, '');
  if (!/^\d{13}$/.test(str)) return null;
  if (!isValidEAN13(str)) {
    console.warn(`[FVS] Invalid EAN13: ${str}`);
    return null;
  }
  return str;
}

function detectFVSMapping(headers: string[]): Record<string, number | null> {
  const normalizedHeaders = headers.map(normalizeFVSHeader);
  const mapping: Record<string, number | null> = {
    ean: null,
    supplier_reference: null,
    product_name: null,
    brand: null,
    category: null,
    purchase_price: null,
    stock_quantity: null,
    vat_rate: null,
  };

  const patterns: Record<string, string[]> = {
    ean: ['code ean', 'ean', 'ean13', 'gtin'],
    supplier_reference: ['code produit', 'reference', 'ref', 'code', 'ref fournisseur'],
    product_name: ['description', 'designation', 'libelle', 'nom', 'article'],
    brand: ['marque', 'brand', 'fabricant'],
    category: ['categorie', 'category', 'gamme', 'famille'],
    purchase_price: ['pau ht', 'prix d\'achat', 'pa ht', 'prix achat ht', 'tarif ht'],
    stock_quantity: ['qte', 'quantite', 'stock'],
    vat_rate: ['tva', 'taux tva', 'tax']
  };

  for (const [field, pats] of Object.entries(patterns)) {
    const matchIndex = normalizedHeaders.findIndex(h => 
      pats.some(p => h.includes(p) || p.includes(h))
    );
    if (matchIndex !== -1) {
      mapping[field] = matchIndex;
    }
  }

  console.log('[FVS-MAPPING] Auto-detected:', mapping);
  return mapping;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inbox_id, user_id, custom_mapping } = await req.json();
    console.log('[DISPATCHER] Starting:', { inbox_id, user_id, has_custom_mapping: !!custom_mapping });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch inbox entry
    const { data: inbox, error: inboxError } = await supabase
      .from('email_inbox')
      .select('*')
      .eq('id', inbox_id)
      .single();

    if (inboxError || !inbox) {
      throw new Error('Inbox entry not found');
    }

    console.log('[DISPATCHER] Email:', {
      attachment_name: inbox.attachment_name,
      attachment_size_kb: inbox.attachment_size_kb,
      from: inbox.from_email
    });

    // Update status to processing
    const processingLogs = [...(inbox.processing_logs || []), {
      timestamp: new Date().toISOString(),
      message: 'Staging started - preparing import',
      attachment: inbox.attachment_name
    }];

    await supabase
      .from('email_inbox')
      .update({ 
        status: 'processing',
        processing_logs: processingLogs
      })
      .eq('id', inbox_id);

    // Download file from storage
    console.log('[DISPATCHER] Downloading from Storage:', inbox.attachment_url);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('email-attachments')
      .download(inbox.attachment_url);

    if (downloadError) throw downloadError;

    const fileBuffer = await fileData.arrayBuffer();
    console.log('[DISPATCHER] Downloaded:', {
      size_mb: (fileBuffer.byteLength / 1024 / 1024).toFixed(2)
    });

    // Handle ZIP if needed
    let processBuffer = fileBuffer;
    let processFileName = inbox.attachment_name;

    if (inbox.attachment_name?.endsWith('.zip')) {
      console.log('[DISPATCHER] ZIP detected - extracting');
      
      const zipReader = new ZipReader(new BlobReader(new Blob([fileBuffer])));
      const entries = await zipReader.getEntries();
      
      const targetEntry = entries.find((e: any) => 
        e.filename.match(/\.(csv|xlsx|xls)$/i) && !e.directory
      );
      
      if (!targetEntry || !targetEntry.getData) {
        throw new Error('No CSV/XLSX/XLS in ZIP');
      }
      
      const writer = new BlobWriter();
      await targetEntry.getData(writer);
      const extractedBlob = await writer.getData();
      processBuffer = await extractedBlob.arrayBuffer();
      processFileName = targetEntry.filename;
      
      await zipReader.close();
      console.log('[DISPATCHER] Extracted:', processFileName);
    }

    // Parse Excel to detect header and mapping
    let rawRows: any[][] = [];
    let headers: string[] = [];
    let headerRowIndex = 0;

    if (processFileName?.match(/\.(xlsx|xls)$/)) {
      const workbook = XLSX.read(processBuffer, { type: 'array', raw: false });
      
      // Find best sheet
      let bestSheet = null;
      let bestSheetName = '';
      let maxDataDensity = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const testRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as any[][];
        
        const dataDensity = testRows.slice(0, 20).reduce((sum: number, row: any) => {
          return sum + (Array.isArray(row) ? row.filter(c => c && String(c).trim()).length : 0);
        }, 0);

        if (dataDensity > maxDataDensity) {
          maxDataDensity = dataDensity;
          bestSheet = sheet;
          bestSheetName = sheetName;
          rawRows = testRows;
        }
      }

      console.log(`[DISPATCHER] Selected sheet: "${bestSheetName}" (density: ${maxDataDensity})`);

      // Detect header row
      const keywords = [
        'prix', 'tarif', 'reference', 'ref', 'code', 'ean',
        'produit', 'article', 'designation', 'description',
        'stock', 'quantite', 'marque', 'categorie', 'pau', 'ht'
      ];

      let bestScore = 0;
      for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const nonEmptyCols = row.filter((c: any) => c && String(c).trim()).length;
        if (nonEmptyCols <= 2) continue;

        const rowText = row.map((c: any) => normalizeFVSHeader(c)).join(' ');
        const matchCount = keywords.filter(kw => rowText.includes(kw)).length;
        
        let score = (nonEmptyCols * 2) + (matchCount * 3);
        
        const nextRow = rawRows[i + 1];
        if (nextRow && nextRow.some((c: any) => c && String(c).trim())) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
      }

      headers = (rawRows[headerRowIndex] || []).map((h: any) => String(h || '').trim());
      console.log(`[DISPATCHER] Header at row ${headerRowIndex + 1}:`, headers.slice(0, 10));

    } else if (processFileName?.includes('.csv')) {
      const text = new TextDecoder().decode(processBuffer);
      const lines = text.split('\n').filter(l => l.trim());
      headers = lines[0].split(/[,;]/).map(h => h.trim());
      rawRows = lines.slice(1).map(line => line.split(/[,;]/));
      console.log('[DISPATCHER] CSV parsed:', headers.slice(0, 10));
    } else {
      throw new Error('Unsupported file format');
    }

    // Determine mapping
    let finalMapping: Record<string, number | null> = {};
    
    if (custom_mapping) {
      // User provided mapping (column names -> indices)
      finalMapping = {};
      for (const [key, colName] of Object.entries(custom_mapping)) {
        if (colName === null) {
          finalMapping[key] = null;
        } else {
          const idx = headers.findIndex(h => h === colName);
          finalMapping[key] = idx !== -1 ? idx : null;
        }
      }
      console.log('[DISPATCHER] Using custom mapping:', finalMapping);
    } else {
      // Auto-detect FVS mapping
      finalMapping = detectFVSMapping(headers);
      
      // Save to supplier config for future
      if (inbox.supplier_id) {
        await supabase
          .from('supplier_configurations')
          .update({ 
            column_mapping: finalMapping,
            skip_rows: headerRowIndex 
          })
          .eq('id', inbox.supplier_id);
      }
    }

    // Convert data rows to NDJSON
    const dataRows = rawRows.slice(headerRowIndex + 1);
    const ndjsonLines: string[] = [];
    let validCount = 0;

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      // Extract values using mapping
      const ean = finalMapping.ean !== null ? row[finalMapping.ean] : null;
      const supplierRef = finalMapping.supplier_reference !== null ? row[finalMapping.supplier_reference] : null;
      const productName = finalMapping.product_name !== null ? row[finalMapping.product_name] : null;
      const brand = finalMapping.brand !== null ? row[finalMapping.brand] : null;
      const category = finalMapping.category !== null ? row[finalMapping.category] : null;
      
      let purchasePrice = null;
      if (finalMapping.purchase_price !== null) {
        purchasePrice = normalizeFVSPrice(row[finalMapping.purchase_price]);
      }
      // Fallback to PPI HT if PAU HT is NC
      if (purchasePrice === null) {
        const fallbackIndex = headers.findIndex(h => 
          normalizeFVSHeader(h).includes('ppi ht') ||
          normalizeFVSHeader(h).includes('ancien pau')
        );
        if (fallbackIndex !== -1) {
          purchasePrice = normalizeFVSPrice(row[fallbackIndex]);
        }
      }

      const stockStatusIndex = headers.findIndex(h => 
        normalizeFVSHeader(h).includes('disponibilite') ||
        normalizeFVSHeader(h).includes('dispo')
      );
      const stockQuantity = normalizeFVSStock(
        finalMapping.stock_quantity !== null ? row[finalMapping.stock_quantity] : null,
        stockStatusIndex !== -1 ? row[stockStatusIndex] : null
      );

      const vatRate = finalMapping.vat_rate !== null ? normalizeFVSPrice(row[finalMapping.vat_rate]) : null;

      // Normalize
      const normalized = {
        ean: normalizeFVSEAN(ean),
        supplier_reference: supplierRef ? String(supplierRef).trim() : null,
        product_name: productName ? String(productName).trim().substring(0, 500) : null,
        brand: brand ? String(brand).trim().substring(0, 100) : null,
        category: category ? String(category).trim().substring(0, 100) : null,
        purchase_price: purchasePrice,
        stock_quantity: stockQuantity,
        vat_rate: vatRate
      };

      // Must have at least ref or name
      if (!normalized.supplier_reference && !normalized.product_name) continue;

      ndjsonLines.push(JSON.stringify(normalized));
      validCount++;
    }

    console.log(`[DISPATCHER] Prepared ${validCount} valid lines from ${dataRows.length} total`);

    // Save NDJSON to storage
    const ndjsonContent = ndjsonLines.join('\n');
    const ndjsonPath = `staged/${user_id}/${inbox_id}.ndjson`;
    
    const { error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(ndjsonPath, new Blob([ndjsonContent], { type: 'application/x-ndjson' }), {
        upsert: true
      });

    if (uploadError) throw uploadError;

    console.log('[DISPATCHER] NDJSON staged:', ndjsonPath);

    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        user_id,
        supplier_id: inbox.supplier_id,
        status: 'queued',
        progress_total: validCount,
        progress_current: 0,
        products_imported: 0,
        products_matched: 0,
        products_errors: 0,
        started_at: new Date().toISOString(),
        metadata: {
          inbox_id,
          ndjson_path: ndjsonPath,
          mapping: finalMapping,
          headers: headers
        }
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log('[DISPATCHER] Job created:', importJob.id);

    // Update inbox to queued
    await supabase
      .from('email_inbox')
      .update({
        status: 'queued',
        processing_logs: [...processingLogs, {
          timestamp: new Date().toISOString(),
          message: `Import queued - ${validCount} products to process`,
          job_id: importJob.id
        }]
      })
      .eq('id', inbox_id);

    // Invoke first chunk immediately
    const chunkSize = 500;
    supabase.functions.invoke('email-import-chunk', {
      body: {
        job_id: importJob.id,
        user_id,
        supplier_id: inbox.supplier_id,
        ndjson_path: ndjsonPath,
        mapping: finalMapping,
        headers: headers,
        offset: 0,
        limit: chunkSize
      }
    }).catch(err => console.error('[DISPATCHER] Chunk invocation error:', err));

    // Return 202 Accepted immediately
    return new Response(JSON.stringify({ 
      success: true,
      job_id: importJob.id,
      status: 'queued',
      total_lines: validCount,
      message: 'Import queued for processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202
    });

  } catch (error: any) {
    console.error('[DISPATCHER] Error:', error);
    
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
