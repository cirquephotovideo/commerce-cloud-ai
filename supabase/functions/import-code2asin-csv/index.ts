// Deno.serve is used instead of the old serve import
// @ts-ignore - Deno edge function compatibility
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, options } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error('Unauthorized');
    }
    
    // 1. Download CSV from storage
    console.log(`Downloading CSV from storage: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError) {
      console.error('Storage download error:', downloadError);
      throw new Error(`Échec du téléchargement: ${downloadError.message}`);
    }

    // 2. Parse CSV content
    console.log('Parsing CSV content...');
    const csvText = await fileData.text();

    // Simple CSV parser
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const csvData: Code2AsinRow[] = lines.slice(1).map((line) => {
      // Handle CSV with quoted values
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
      values.push(currentValue.trim()); // Last value
      
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.replace(/^"|"$/g, '') || undefined;
      });
      return row;
    });

    console.log(`Parsed ${csvData.length} rows from CSV`);

    // Validation
    if (csvData.length === 0) {
      throw new Error('CSV vide ou invalide');
    }

    // Vérifier que la colonne EAN existe
    if (!csvData[0].EAN && !csvData[0].ean) {
      throw new Error("Colonne 'EAN' manquante dans le CSV");
    }
    
    console.log(`Starting Code2ASIN import for user ${user.id}, ${csvData.length} rows`);
    
    // Create job record immediately
    const { data: job, error: jobError } = await supabaseClient
      .from('code2asin_import_jobs')
      .insert({
        user_id: user.id,
        filename: options?.filename || 'code2asin_import.csv',
        total_rows: csvData.length,
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (jobError || !job) {
      throw new Error('Failed to create import job');
    }
    
    const jobId = job.id;
    const importStartTime = Date.now();
    
    // Background processing function
    const processRows = async () => {
      const results = {
        total: csvData.length,
        success: 0,
        failed: 0,
        created: 0,
        updated: 0,
        errors: [] as string[]
      };
      
      try {
        // Update job to processing
        await supabaseClient
          .from('code2asin_import_jobs')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', jobId);
        const BATCH_SIZE = 20;
        
        for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
          const batch = csvData.slice(i, i + BATCH_SIZE) as Code2AsinRow[];
          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(csvData.length / BATCH_SIZE)} (${batch.length} rows)`);
          
          // Batch fetch existing analyses
          const batchEans = batch.map(r => r.EAN).filter(Boolean);
          const { data: existingAnalyses } = await supabaseClient
            .from('product_analyses')
            .select('id, ean')
            .eq('user_id', user.id)
            .in('ean', batchEans);
          
          const analysisMap = new Map(
            existingAnalyses?.map(a => [a.ean, a.id]) || []
          );
          
          for (const row of batch) {
            try {
              if (!row.EAN) {
                results.failed++;
                results.errors.push(`EAN manquant`);
                continue;
              }
              
              // Get analysis from batch map
              let analysisId = analysisMap.get(row.EAN);
              
              // Create analysis if not found and option enabled
              if (!analysisId && options.createMissing) {
                const { data: newAnalysis, error: createError } = await supabaseClient
                  .from('product_analyses')
                  .insert({
                    user_id: user.id,
                    product_url: row.ASIN ? `https://amazon.fr/dp/${row.ASIN}` : `ean:${row.EAN}`,
                    ean: row.EAN,
                    analysis_result: {
                      product_name: row.Titre || 'Produit importé Code2ASIN',
                      brand: row.Marque,
                      ean: row.EAN
                    },
                    code2asin_enrichment_status: 'pending'
                  })
                  .select('id')
                  .single();
                
                if (createError) {
                  results.failed++;
                  results.errors.push(`EAN ${row.EAN}: ${createError.message}`);
                  continue;
                }
                
                analysisId = newAnalysis?.id;
                analysisMap.set(row.EAN, analysisId);
                results.created++;
              }
              
              if (!analysisId) {
                results.failed++;
                results.errors.push(`EAN ${row.EAN}: Analyse non trouvée`);
                continue;
              }
              
              // Parse images
              const imageUrls = row.Images ? 
                row.Images.split(',').map((url: string) => url.trim()).filter(Boolean) : [];
              
              // Parse numeric values safely
              const parseFloat = (value?: string) => {
                if (!value) return null;
                const cleaned = value.replace(',', '.');
                const parsed = Number(cleaned);
                return isNaN(parsed) ? null : parsed;
              };
              
              const parseInt = (value?: string) => {
                if (!value) return null;
                const parsed = Number(value);
                return isNaN(parsed) ? null : parsed;
              };
              
              // Prepare enrichment data
              const enrichmentData = {
                user_id: user.id,
                analysis_id: analysisId,
                asin: row.ASIN,
                ean: row.EAN,
                upc: row.UPC,
                part_number: row['Numéro de pièce'],
                title: row.Titre,
                brand: row.Marque,
                manufacturer: row.Fabricant,
                product_group: row['Groupe de produits'],
                product_type: row.Type,
                browse_nodes: row['Parcourir les nœuds'],
                buybox_price: parseFloat(row['Prix Buy Box Nouvelle (€)']),
                buybox_seller_name: row["Nom du vendeur dans l'offre Buy Box Nouvelle"],
                buybox_is_fba: row["La Buy Box Nouvelle est-elle gérée par Amazon ?"] === 'TRUE',
                buybox_is_amazon: row["La Buy Box Nouvelle est-elle d'Amazon ?"] === 'TRUE',
                amazon_price: parseFloat(row['Prix Amazon (€)']),
                lowest_fba_new: parseFloat(row["Prix le plus bas FBA en 'Neuf' (€)"]),
                lowest_new: parseFloat(row["Prix le plus bas en 'Neuf' (€)"]),
                lowest_used: parseFloat(row["Prix le plus bas en 'D'occasion' (€)"]),
                list_price: parseFloat(row['Prix de liste (€)']),
                image_urls: imageUrls,
                item_length_cm: parseFloat(row["Longueur de l'article (cm)"]),
                item_width_cm: parseFloat(row["Largeur de l'article (cm)"]),
                item_height_cm: parseFloat(row["Hauteur de l'article (cm)"]),
                item_weight_g: parseFloat(row["Poids de l'article (g)"]),
                package_length_cm: parseFloat(row["Longueur du paquet (cm)"]),
                package_width_cm: parseFloat(row["Largeur du paquet (cm)"]),
                package_height_cm: parseFloat(row["Hauteur du paquet (cm)"]),
                package_weight_g: parseFloat(row["Poids de l'emballage (g)"]),
                offer_count_new: parseInt(row["Nombre d'offres en 'Neuf'"]),
                offer_count_used: parseInt(row["Nombre d'offres en 'D'occasion'"]),
                referral_fee_percentage: parseFloat(row['Pourcentage de commission de référence']),
                fulfillment_fee: parseFloat(row["Frais de préparation et d'emballage (€)"]),
                sales_rank: row['Rangs de vente'],
                color: row.Couleur,
                size: row.Taille,
                features: row.Fonctionnalités,
                marketplace: row.Marché
              };
              
              // Upsert enrichment
              const { error: upsertError } = await supabaseClient
                .from('code2asin_enrichments')
                .upsert(enrichmentData, {
                  onConflict: 'analysis_id'
                });

              if (upsertError) {
                console.error(`Enrichment failed for EAN ${row.EAN}:`, upsertError);
                results.failed++;
                results.errors.push(`EAN ${row.EAN}: ${upsertError.message}`);
                continue;
              }
              
              // Update product_analyses
              await supabaseClient
                .from('product_analyses')
                .update({
                  code2asin_enrichment_status: 'completed',
                  code2asin_enriched_at: new Date().toISOString(),
                  image_urls: imageUrls.length > 0 ? imageUrls : undefined
                })
                .eq('id', analysisId);
              
              results.success++;
              results.updated++;
              
            } catch (error: any) {
              results.failed++;
              results.errors.push(`EAN ${row.EAN}: ${error.message}`);
              console.error(`Error processing EAN ${row.EAN}:`, error);
            }
          }
          
          // Update job progress
          await supabaseClient
            .from('code2asin_import_jobs')
            .update({
              processed_rows: i + batch.length,
              success_count: results.success,
              failed_count: results.failed,
              created_count: results.created,
              updated_count: results.updated
            })
            .eq('id', jobId);
          
          // Small delay between batches
          if (i + BATCH_SIZE < csvData.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`Import completed: ${results.success} success, ${results.failed} failed`);
        
        // Update job to completed
        await supabaseClient
          .from('code2asin_import_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            errors: results.errors
          })
          .eq('id', jobId);
        
        // Log to history
        try {
          await supabaseClient
            .from('code2asin_import_logs')
            .insert({
              user_id: user.id,
              filename: options?.filename || 'code2asin_import.csv',
              total_rows: results.total,
              success_count: results.success,
              failed_count: results.failed,
              created_count: results.created,
              updated_count: results.updated,
              errors: results.errors,
              import_duration_ms: Date.now() - importStartTime,
              completed_at: new Date().toISOString()
            });
        } catch (logError) {
          console.error('Error logging import:', logError);
        }
      } catch (error: any) {
        console.error('Background processing error:', error);
        await supabaseClient
          .from('code2asin_import_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
      }
    };
    
    // Start background processing
    // @ts-ignore - Deno Deploy waitUntil
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processRows());
    } else {
      processRows().catch(console.error);
    }
    
    // Return immediately with job info
    return new Response(
      JSON.stringify({
        success: true,
        started: true,
        job_id: jobId,
        total_rows: csvData.length,
        message: `Import started in background`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
