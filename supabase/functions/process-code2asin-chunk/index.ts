// @ts-ignore - Deno edge function compatibility
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 100;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { jobId, chunkId, filePath, startRow, endRow } = await req.json();
    
    console.log(`[CHUNK-PROCESSOR] Starting chunk ${chunkId} for job ${jobId}`);
    console.log(`[CHUNK-PROCESSOR] Processing rows ${startRow} to ${endRow}`);

    await supabaseClient
      .from('code2asin_import_chunks')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chunkId);

    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Storage download failed: ${downloadError.message}`);
    }

    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const chunkLines = lines.slice(startRow, endRow + 1);
    console.log(`[CHUNK-PROCESSOR] Parsed ${chunkLines.length} rows for this chunk`);

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

    const { data: job, error: jobFetchError } = await supabaseClient
      .from('code2asin_import_jobs')
      .select('user_id')
      .eq('id', jobId)
      .maybeSingle();

    if (jobFetchError) {
      console.error('[CHUNK-PROCESSOR] Failed to fetch job:', jobFetchError);
      throw new Error(`Failed to fetch job: ${jobFetchError.message}`);
    }

    if (!job) {
      console.error('[CHUNK-PROCESSOR] Job not found:', jobId);
      throw new Error('Job not found');
    }

    const userId = job.user_id;

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      const batch = csvData.slice(i, i + BATCH_SIZE);
      console.log(`[CHUNK-PROCESSOR] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(csvData.length / BATCH_SIZE)}`);

      const eans = batch.map(row => row.EAN).filter(Boolean);
      
      const { data: existingAnalyses } = await supabaseClient
        .from('product_analyses')
        .select('id, ean')
        .eq('user_id', userId)
        .in('ean', eans);

      const existingMap = new Map(
        (existingAnalyses || []).map(a => [a.ean?.toLowerCase(), a.id])
      );

      const enrichments = [];

      for (const row of batch) {
        try {
          const ean = row.EAN?.trim();
          if (!ean) {
            failedCount++;
            continue;
          }

          let analysisId = existingMap.get(ean.toLowerCase());

          // Always try to create missing analyses
          if (!analysisId) {
            const { data: newAnalysis } = await supabaseClient
              .from('product_analyses')
              .insert({
                user_id: userId,
                ean: ean,
                analysis_result: { description: row.Titre || 'Produit importé' }
              })
              .select('id')
              .single();

            if (newAnalysis) {
              analysisId = newAnalysis.id;
              existingMap.set(ean.toLowerCase(), analysisId);
              createdCount++;
            }
          }

          if (!analysisId) {
            failedCount++;
            continue;
          }

          const enrichmentData: any = {
            analysis_id: analysisId,
            user_id: userId,
            asin: row.ASIN,
            ean: ean,
            upc: row.UPC,
            part_number: row['Numéro de pièce'],
            title: row.Titre,
            brand: row.Marque,
            manufacturer: row.Fabricant,
            product_group: row['Groupe de produits'],
            product_type: row.Type,
            browse_nodes: row['Parcourir les nœuds'],
            
            // Prix - noms corrigés
            buybox_price: parseFloat(row['Prix Buy Box Nouvelle (€)'] || '0') || null,
            buybox_seller_name: row["Nom du vendeur dans l'offre Buy Box Nouvelle"],
            buybox_is_fba: row["La Buy Box Nouvelle est-elle gérée par Amazon ?"] === 'OUI',
            buybox_is_amazon: row["La Buy Box Nouvelle est-elle d'Amazon ?"] === 'OUI',
            amazon_price: parseFloat(row['Prix Amazon (€)'] || '0') || null,
            lowest_fba_new: parseFloat(row["Prix le plus bas FBA en 'Neuf' (€)"] || '0') || null,
            lowest_new: parseFloat(row["Prix le plus bas en 'Neuf' (€)"] || '0') || null,
            lowest_used: parseFloat(row["Prix le plus bas en 'D'occasion' (€)"] || '0') || null,
            list_price: parseFloat(row['Prix de liste (€)'] || '0') || null,
            
            // Dimensions - suffixes _cm et _g ajoutés
            item_length_cm: parseFloat(row["Longueur de l'article (cm)"] || '0') || null,
            item_width_cm: parseFloat(row["Largeur de l'article (cm)"] || '0') || null,
            item_height_cm: parseFloat(row["Hauteur de l'article (cm)"] || '0') || null,
            item_weight_g: parseFloat(row["Poids de l'article (g)"] || '0') || null,
            package_length_cm: parseFloat(row["Longueur du paquet (cm)"] || '0') || null,
            package_width_cm: parseFloat(row["Largeur du paquet (cm)"] || '0') || null,
            package_height_cm: parseFloat(row["Hauteur du paquet (cm)"] || '0') || null,
            package_weight_g: parseFloat(row["Poids de l'emballage (g)"] || '0') || null,
            
            // Offres - préfixe offer_count_ au lieu de suffixe _count
            offer_count_new: parseInt(row["Nombre d'offres en 'Neuf'"] || '0') || null,
            offer_count_used: parseInt(row["Nombre d'offres en 'D'occasion'"] || '0') || null,
            
            // Frais
            referral_fee_percentage: parseFloat(row['Pourcentage de commission de référence'] || '0') || null,
            fulfillment_fee: parseFloat(row["Frais de préparation et d'emballage (€)"] || '0') || null,
            
            // Autres
            image_urls: row.Images ? [row.Images] : null,
            sales_rank: row['Rangs de vente'],
            color: row.Couleur,
            size: row.Taille,
            features: row.Fonctionnalités,
            marketplace: row.Marché
          };

          enrichments.push(enrichmentData);
          successCount++;

        } catch (err) {
          console.error('[CHUNK-PROCESSOR] Error processing row:', err);
          failedCount++;
        }
      }

      if (enrichments.length > 0) {
        // Deduplicate by analysis_id to prevent "ON CONFLICT DO UPDATE" errors
        const enrichmentMap = new Map<string, any>();
        enrichments.forEach(enrich => {
          enrichmentMap.set(enrich.analysis_id, enrich); // Keep last occurrence
        });
        const uniqueEnrichments = Array.from(enrichmentMap.values());

        const duplicateCount = enrichments.length - uniqueEnrichments.length;
        if (duplicateCount > 0) {
          console.log(`[CHUNK-PROCESSOR] Deduplication: ${enrichments.length} → ${uniqueEnrichments.length} unique entries (${duplicateCount} duplicates removed)`);
        }

        const { error: enrichError } = await supabaseClient
          .from('code2asin_enrichments')
          .upsert(uniqueEnrichments, {
            onConflict: 'analysis_id',
            ignoreDuplicates: false
          });

        if (enrichError) {
          console.error('[CHUNK-PROCESSOR] Enrichment upsert error:', enrichError);
        }

        for (const enrich of uniqueEnrichments) {
          await supabaseClient
            .from('product_analyses')
            .update({
              code2asin_enrichment_status: 'completed',
              image_urls: enrich.image_urls || []
            })
            .eq('id', enrich.analysis_id);
        }

        updatedCount += uniqueEnrichments.length - createdCount;
      }

      processedCount += batch.length;

      await supabaseClient
        .from('code2asin_import_chunks')
        .update({
          processed_rows: processedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', chunkId);
    }

    console.log(`[CHUNK-PROCESSOR] Chunk stats: ${successCount} success, ${failedCount} failed, ${createdCount} created, ${updatedCount} updated`);

    await supabaseClient
      .from('code2asin_import_chunks')
      .update({
        status: 'completed',
        processed_rows: processedCount,
        success_count: successCount,
        failed_count: failedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chunkId);

    console.log(`[CHUNK-PROCESSOR] Chunk ${chunkId} completed and counters saved`);

    const { data: allChunks } = await supabaseClient
      .from('code2asin_import_chunks')
      .select('*')
      .eq('job_id', jobId);

    if (allChunks) {
      const totalProcessed = allChunks.reduce((sum, c) => sum + (c.processed_rows || 0), 0);
      const totalSuccess = allChunks.reduce((sum, c) => sum + (c.success_count || 0), 0);
      const totalFailed = allChunks.reduce((sum, c) => sum + (c.failed_count || 0), 0);
      const totalCreated = allChunks.reduce((sum, c) => sum + (c.created_count || 0), 0);
      const totalUpdated = allChunks.reduce((sum, c) => sum + (c.updated_count || 0), 0);
      
      const completedChunks = allChunks.filter(c => c.status === 'completed').length;
      const failedChunks = allChunks.filter(c => c.status === 'failed').length;
      const totalChunks = allChunks.length;

      const jobStatus = 
        completedChunks === totalChunks ? 'completed' :
        failedChunks > 0 && (completedChunks + failedChunks) === totalChunks ? 'failed' :
        'processing';

      await supabaseClient
        .from('code2asin_import_jobs')
        .update({
          processed_rows: totalProcessed,
          success_count: totalSuccess,
          failed_count: totalFailed,
          created_count: totalCreated,
          updated_count: totalUpdated,
          status: jobStatus,
          completed_at: jobStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', jobId);

      console.log(`[CHUNK-PROCESSOR] Job ${jobId} updated: ${totalSuccess} enriched, ${totalFailed} failed, ${completedChunks}/${totalChunks} chunks done`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunkId,
        processed: processedCount,
        successCount,
        failed: failedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[CHUNK-PROCESSOR] Fatal error:', error);

    try {
      const { chunkId } = await req.json();
      await supabaseClient
        .from('code2asin_import_chunks')
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', chunkId);
    } catch (updateError) {
      console.error('[CHUNK-PROCESSOR] Failed to update chunk status:', updateError);
    }

    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
