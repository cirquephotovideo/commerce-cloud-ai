import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration optimisée pour éviter les timeouts
const BATCH_SIZE = 25;
const PROGRESS_UPDATE_INTERVAL = 5;
const DELAY_BETWEEN_BATCHES = 500; // ms
const DELAY_BETWEEN_PRODUCTS = 2000; // 2s entre chaque produit
const PRODUCT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max par produit
const MAX_RETRY_ATTEMPTS = 3;

interface DeleteJobRecord {
  id: string;
  user_id: string;
  product_ids: string[];
  status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  progress_current: number;
  progress_total: number;
  deleted_count: number;
  errors: any[];
  started_at?: string;
  completed_at?: string;
  logs: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header manquant');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Non autorisé');
    }

    const { productIds } = await req.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Liste de produits invalide');
    }

    console.log(`[BULK-DELETE-PRODUCTS] 🚀 Starting deletion for ${productIds.length} products`);
    console.log(`[BULK-DELETE-PRODUCTS] 📋 Product IDs: ${productIds.join(', ')}`);

    // Créer un enregistrement de job
    const { data: jobData, error: jobError } = await supabase
      .from('bulk_deletion_jobs')
      .insert({
        user_id: user.id,
        job_type: 'bulk_delete_products',
        status: 'pending',
        progress_current: 0,
        progress_total: productIds.length,
        deleted_count: 0,
        metadata: {
          product_ids: productIds,
          batch_size: BATCH_SIZE,
          delay_between_batches: DELAY_BETWEEN_BATCHES,
          delay_between_products: DELAY_BETWEEN_PRODUCTS,
        },
        logs: ['Job créé', `${productIds.length} produits à supprimer`],
      })
      .select()
      .single();

    if (jobError) {
      console.error('[BULK-DELETE-PRODUCTS] ❌ Error creating job:', jobError);
      throw jobError;
    }

    console.log(`[BULK-DELETE-PRODUCTS] ✅ Job created: ${jobData.id}`);

    // Lancer le traitement asynchrone
    processDeleteProductsAsync(supabase, jobData.id, productIds, user.id).catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobData.id,
        message: `Suppression de ${productIds.length} produit(s) en cours...`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[BULK-DELETE-PRODUCTS] ❌ Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function processDeleteProductsAsync(
  supabase: any,
  jobId: string,
  productIds: string[],
  userId: string
) {
  const logs: string[] = [];
  const errors: any[] = [];
  let deletedCount = 0;

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    logs.push(logMessage);
    console.log(`[BULK-DELETE-PRODUCTS] ${logMessage}`);
  };

  const updateJob = async (updates: Partial<DeleteJobRecord>) => {
    const { error } = await supabase
      .from('bulk_deletion_jobs')
      .update({ ...updates, logs, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    
    if (error) {
      console.error('[BULK-DELETE-PRODUCTS] ❌ Error updating job:', error);
    }
  };

  try {
    await updateJob({ status: 'processing', started_at: new Date().toISOString() });
    addLog(`🚀 Début de la suppression de ${productIds.length} produits`);

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const productStartTime = Date.now();

      addLog(`\n📦 [${i + 1}/${productIds.length}] Produit: ${productId}`);

      try {
        // 1. Vérifier que le produit existe et appartient à l'utilisateur
        const { data: product, error: productError } = await supabase
          .from('supplier_products')
          .select('id, product_name, supplier_id')
          .eq('id', productId)
          .eq('user_id', userId)
          .single();

        if (productError || !product) {
          addLog(`⚠️ Produit non trouvé ou non autorisé: ${productId}`);
          errors.push({ product_id: productId, error: 'Produit non trouvé' });
          continue;
        }

        addLog(`📝 Nom: ${product.product_name || 'Sans nom'}`);

        // 2. Récupérer les IDs d'analyse liés
        const { data: links } = await supabase
          .from('product_links')
          .select('analysis_id')
          .eq('supplier_product_id', productId);

        const analysisIds = links?.map((l: any) => l.analysis_id) || [];
        addLog(`🔗 ${analysisIds.length} analyse(s) liée(s)`);

        // 3. Supprimer enrichment_queue
        addLog('🗑️ Suppression enrichment_queue...');
        const { error: eqError } = await supabase
          .from('enrichment_queue')
          .delete()
          .eq('supplier_product_id', productId);
        
        if (eqError) {
          addLog(`⚠️ Erreur enrichment_queue: ${eqError.message}`);
        } else {
          addLog('✅ enrichment_queue supprimé');
        }

        // 4. Supprimer product_links
        addLog('🗑️ Suppression product_links...');
        const { error: plError } = await supabase
          .from('product_links')
          .delete()
          .eq('supplier_product_id', productId);
        
        if (plError) {
          addLog(`⚠️ Erreur product_links: ${plError.message}`);
        } else {
          addLog('✅ product_links supprimé');
        }

        // 5. Supprimer les données d'enrichissement pour chaque analyse
        for (const analysisId of analysisIds) {
          addLog(`📊 Nettoyage analyse: ${analysisId}`);

          // Amazon data
          const { error: amzError } = await supabase
            .from('amazon_product_data')
            .delete()
            .eq('analysis_id', analysisId);
          
          if (amzError) {
            addLog(`⚠️ Erreur amazon_product_data: ${amzError.message}`);
          }

          // Videos
          const { error: videoError } = await supabase
            .from('product_videos')
            .delete()
            .eq('analysis_id', analysisId);
          
          if (videoError) {
            addLog(`⚠️ Erreur product_videos: ${videoError.message}`);
          }

          // Vérifier si l'analyse a d'autres liens
          const { count } = await supabase
            .from('product_links')
            .select('*', { count: 'exact', head: true })
            .eq('analysis_id', analysisId);

          if (count === 0) {
            addLog(`🗑️ Suppression analyse orpheline: ${analysisId}`);
            const { error: analysisError } = await supabase
              .from('product_analyses')
              .delete()
              .eq('id', analysisId);
            
            if (analysisError) {
              addLog(`⚠️ Erreur product_analyses: ${analysisError.message}`);
            } else {
              addLog('✅ Analyse supprimée');
            }
          }
        }

        // 6. Supprimer supplier_price_variants
        addLog('🗑️ Suppression price_variants...');
        const { error: pvError } = await supabase
          .from('supplier_price_variants')
          .delete()
          .eq('supplier_product_id', productId);
        
        if (pvError) {
          addLog(`⚠️ Erreur price_variants: ${pvError.message}`);
        } else {
          addLog('✅ price_variants supprimé');
        }

        // 7. Supprimer le produit lui-même
        addLog('🗑️ Suppression produit...');
        const { error: deleteError } = await supabase
          .from('supplier_products')
          .delete()
          .eq('id', productId);

        if (deleteError) {
          throw new Error(`Erreur suppression produit: ${deleteError.message}`);
        }

        deletedCount++;
        const elapsed = Date.now() - productStartTime;
        addLog(`✅ Produit ${productId} supprimé (${elapsed}ms)`);

        // Mise à jour de la progression
        await updateJob({
          progress_current: i + 1,
          deleted_count: deletedCount,
          errors,
        });

        // Délai entre produits pour éviter surcharge
        if (i < productIds.length - 1) {
          addLog(`⏳ Pause ${DELAY_BETWEEN_PRODUCTS}ms avant produit suivant...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PRODUCTS));
        }

      } catch (productError) {
        const errorMessage = productError instanceof Error ? productError.message : 'Unknown error';
        addLog(`❌ ERREUR produit ${productId}: ${errorMessage}`);
        errors.push({
          product_id: productId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });

        await updateJob({ errors });
      }

      // Timeout check
      if (Date.now() - productStartTime > PRODUCT_TIMEOUT_MS) {
        addLog(`⏱️ TIMEOUT produit ${productId} (${PRODUCT_TIMEOUT_MS}ms dépassé)`);
        errors.push({
          product_id: productId,
          error: 'Timeout',
        });
        break;
      }
    }

    // Finalisation
    const finalStatus = errors.length > 0 
      ? (deletedCount > 0 ? 'completed_with_errors' : 'failed')
      : 'completed';

    addLog(`\n🏁 Suppression terminée`);
    addLog(`✅ ${deletedCount} produit(s) supprimé(s)`);
    addLog(`❌ ${errors.length} erreur(s)`);

    await updateJob({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      progress_current: productIds.length,
      deleted_count: deletedCount,
      errors,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    addLog(`💥 ERREUR FATALE: ${errorMessage}`);
    
    await updateJob({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [...errors, { error: errorMessage, fatal: true }],
    });
  }
}
