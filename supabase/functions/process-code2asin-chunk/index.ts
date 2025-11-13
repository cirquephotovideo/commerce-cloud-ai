// Deno.serve is used instead of the old serve import
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Code2AsinRow {
  ASIN?: string;
  Titre?: string;
  EAN?: string;
  UPC?: string;
  'Numéro de pièce'?: string;
  'Prix Buy Box Nouvelle (€)'?: string;
  'Prix Amazon (€)'?: string;
  "Prix le plus bas FBA en 'Neuf' (€)"?: string;
  "Prix le plus bas en 'Neuf' (€)"?: string;
  "Prix le plus bas en 'D'occasion' (€)"?: string;
  'Prix de liste (€)'?: string;
  Marque?: string;
  Fabricant?: string;
  Images?: string;
  "Longueur de l'article (cm)"?: string;
  "Largeur de l'article (cm)"?: string;
  "Hauteur de l'article (cm)"?: string;
  "Poids de l'article (g)"?: string;
  "Longueur du paquet (cm)"?: string;
  "Largeur du paquet (cm)"?: string;
  "Hauteur du paquet (cm)"?: string;
  "Poids de l'emballage (g)"?: string;
  "Nombre d'offres en 'Neuf'"?: string;
  "Nombre d'offres en 'D'occasion'"?: string;
  'Pourcentage de commission de référence'?: string;
  "Frais de préparation et d'emballage (€)"?: string;
  'Rangs de vente'?: string;
  Couleur?: string;
  Taille?: string;
  Fonctionnalités?: string;
  Marché?: string;
  'Groupe de produits'?: string;
  Type?: string;
  'Parcourir les nœuds'?: string;
  "Nom du vendeur dans l'offre Buy Box Nouvelle"?: string;
  "La Buy Box Nouvelle est-elle gérée par Amazon ?"?: string;
  "La Buy Box Nouvelle est-elle d'Amazon ?"?: string;
  [key: string]: string | undefined;
}

const BATCH_SIZE = 100; // Process 100 products at a time

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, chunkId, filePath, startRow, endRow } = await req.json();
    
    console.log(`[CHUNK-PROCESSOR] Processing chunk ${chunkId} for job ${jobId}: rows ${startRow}-${endRow}`);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Update chunk status to processing
    await supabaseClient
      .from('code2asin_import_chunks')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', chunkId);
    
    // Download and parse CSV
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Parse only the chunk range
    const chunkLines = lines.slice(startRow + 1, endRow + 1); // +1 because line[0] is headers
    
    const csvData: Code2AsinRow[] = chunkLines.map((line) => {
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.replace(/^"|"$/g, '') || undefined;
      });
      return row;
    });

    console.log(`[CHUNK-PROCESSOR] Parsed ${csvData.length} rows`);

    // Validate EAN presence
    const hasEan = csvData.some(row => row.EAN);
    if (!hasEan) {
      throw new Error('Column EAN not found in CSV');
    }

    // Get user_id from job
    const { data: job } = await supabaseClient
      .from('code2asin_import_jobs')
      .select('user_id')
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new Error('Job not found');
    }

    const userId = job.user_id;
    let processedCount = 0;

    // Process in batches
    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      const eans = batch.map(row => row.EAN).filter(Boolean);

      // Fetch existing analyses
      const { data: existingAnalyses } = await supabaseClient
        .from('product_analyses')
        .select('id, ean')
        .in('ean', eans)
        .eq('user_id', userId);

      const existingEansMap = new Map(
        (existingAnalyses || []).map(a => [a.ean, a.id])
      );

      // Prepare enrichments
      const enrichmentsToUpsert = [];

      for (const row of batch) {
        if (!row.EAN) continue;

        let analysisId = existingEansMap.get(row.EAN);

        // Create analysis if doesn't exist
        if (!analysisId) {
          const { data: newAnalysis } = await supabaseClient
            .from('product_analyses')
            .insert({
              user_id: userId,
              ean: row.EAN,
              analysis_result: {
                product_name: row.Titre || 'Unknown',
                description: row.Titre,
              },
              status: 'completed',
            })
            .select('id')
            .single();

          if (newAnalysis) {
            analysisId = newAnalysis.id;
            existingEansMap.set(row.EAN, analysisId);
          }
        }

        if (analysisId) {
          // Prepare enrichment data
          enrichmentsToUpsert.push({
            analysis_id: analysisId,
            user_id: userId,
            asin: row.ASIN,
            title: row.Titre,
            brand: row.Marque,
            manufacturer: row.Fabricant,
            buy_box_price: parseFloat(row['Prix Buy Box Nouvelle (€)'] || '0'),
            amazon_price: parseFloat(row['Prix Amazon (€)'] || '0'),
            lowest_fba_price: parseFloat(row["Prix le plus bas FBA en 'Neuf' (€)"] || '0'),
            lowest_new_price: parseFloat(row["Prix le plus bas en 'Neuf' (€)"] || '0'),
            lowest_used_price: parseFloat(row["Prix le plus bas en 'D'occasion' (€)"] || '0'),
            list_price: parseFloat(row['Prix de liste (€)'] || '0'),
            image_urls: row.Images ? row.Images.split('|').slice(0, 5) : [],
            dimensions: {
              length: row["Longueur de l'article (cm)"],
              width: row["Largeur de l'article (cm)"],
              height: row["Hauteur de l'article (cm)"],
              weight: row["Poids de l'article (g)"],
            },
            package_dimensions: {
              length: row["Longueur du paquet (cm)"],
              width: row["Largeur du paquet (cm)"],
              height: row["Hauteur du paquet (cm)"],
              weight: row["Poids de l'emballage (g)"],
            },
            offers_new: parseInt(row["Nombre d'offres en 'Neuf'"] || '0'),
            offers_used: parseInt(row["Nombre d'offres en 'D'occasion'"] || '0'),
            referral_fee_percent: parseFloat(row['Pourcentage de commission de référence'] || '0'),
            prep_fee: parseFloat(row["Frais de préparation et d'emballage (€)"] || '0'),
            sales_rank: row['Rangs de vente'],
            color: row.Couleur,
            size: row.Taille,
            features: row.Fonctionnalités,
            marketplace: row.Marché,
            product_group: row['Groupe de produits'],
            type: row.Type,
            browse_nodes: row['Parcourir les nœuds'],
            buy_box_seller: row["Nom du vendeur dans l'offre Buy Box Nouvelle"],
            is_amazon_fulfilled: row["La Buy Box Nouvelle est-elle gérée par Amazon ?"] === 'Oui',
            is_amazon_seller: row["La Buy Box Nouvelle est-elle d'Amazon ?"] === 'Oui',
          });
        }

        processedCount++;
      }

      // Bulk upsert enrichments
      if (enrichmentsToUpsert.length > 0) {
        await supabaseClient
          .from('code2asin_enrichments')
          .upsert(enrichmentsToUpsert, { onConflict: 'analysis_id' });

        // Update product_analyses with enrichment status
        const analysisIds = enrichmentsToUpsert.map(e => e.analysis_id);
        await supabaseClient
          .from('product_analyses')
          .update({
            has_amazon_enrichment: true,
            image_urls: supabaseClient.rpc('array_cat', {
              arr1: 'image_urls',
              arr2: enrichmentsToUpsert[0].image_urls,
            }),
          })
          .in('id', analysisIds);
      }

      // Update chunk progress
      await supabaseClient
        .from('code2asin_import_chunks')
        .update({ 
          processed_rows: processedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', chunkId);

      console.log(`[CHUNK-PROCESSOR] Batch ${i / BATCH_SIZE + 1}: ${processedCount}/${csvData.length} processed`);
    }

    // Mark chunk as completed
    await supabaseClient
      .from('code2asin_import_chunks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_rows: processedCount,
      })
      .eq('id', chunkId);

    console.log(`[CHUNK-PROCESSOR] ✅ Chunk ${chunkId} completed: ${processedCount} products`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        chunkId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHUNK-PROCESSOR] Error:', error);
    
    // Try to extract chunkId from error context if available
    let chunkId;
    try {
      const body = await req.clone().json();
      chunkId = body.chunkId;
    } catch {
      console.error('[CHUNK-PROCESSOR] Could not extract chunkId from request');
    }
    
    if (chunkId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient
        .from('code2asin_import_chunks')
        .update({ 
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', chunkId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
