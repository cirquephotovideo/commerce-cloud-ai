import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvData, options } = await req.json();
    
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
    
    const importStartTime = Date.now();
    console.log(`Starting Code2ASIN import for user ${user.id}, ${csvData.length} rows`);
    
    const results = {
      total: csvData.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [] as string[]
    };
    
    // Process function
    const processRows = async () => {
      const BATCH_SIZE = 20;
      
      for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
        const batch = csvData.slice(i, i + BATCH_SIZE) as Code2AsinRow[];
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(csvData.length / BATCH_SIZE)} (${batch.length} rows)`);
        
        for (const row of batch) {
          try {
            if (!row.EAN) {
              results.failed++;
              results.errors.push(`Ligne ${i + 1}: EAN manquant`);
              continue;
            }
            
            // 1. Find analysis by EAN
            const { data: analysis } = await supabaseClient
              .from('product_analyses')
              .select('id')
              .eq('ean', row.EAN)
              .eq('user_id', user.id)
              .maybeSingle();
            
            let analysisId = analysis?.id;
            
            // 2. Create analysis if not found and option enabled
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
              results.created++;
            }
            
            if (!analysisId) {
              results.failed++;
              results.errors.push(`EAN ${row.EAN}: Analyse non trouvée`);
              continue;
            }
            
            // 3. Parse images
            const imageUrls = row.Images ? 
              row.Images.split(',').map((url: string) => url.trim()).filter(Boolean) : [];
            
            // 4. Parse numeric values safely
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
            
            // 5. Prepare enrichment data
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
            
            // 6. Upsert code2asin_enrichments with retry mechanism
            const maxRetries = 3;
            let retryCount = 0;
            let upsertError: any = null;

            while (retryCount < maxRetries) {
              const { error } = await supabaseClient
                .from('code2asin_enrichments')
                .upsert(enrichmentData, {
                  onConflict: 'analysis_id'
                });
              
              if (!error) {
                upsertError = null;
                break;
              }
              
              upsertError = error;
              retryCount++;
              console.warn(`Retry ${retryCount}/${maxRetries} for EAN ${row.EAN}: ${error.message}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }

            if (upsertError) {
              console.error(`Enrichment upsert failed for EAN ${row.EAN} after ${maxRetries} retries:`, upsertError);
              results.failed++;
              results.errors.push(`EAN ${row.EAN}: ${upsertError.message}`);
              continue;
            }
            
            // 7. Update product_analyses
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
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < csvData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Import completed: ${results.success} success, ${results.failed} failed`);
      
      // Log the import to history
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
    };
    
    // Process synchronously to return complete results
    await processRows();
    
    // Return complete results
    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        message: `Import completed: ${results.success}/${results.total} products enriched`
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
