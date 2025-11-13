import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { retryWithBackoff } from '../_shared/retry-with-backoff.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 100; // Réduit de 500 à 100 pour éviter les timeouts
const PROGRESS_UPDATE_INTERVAL = 10; // Update tous les 10 batches
const SUPPLIER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max par fournisseur

interface DeleteSupplierRequest {
  supplierIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { supplierIds }: DeleteSupplierRequest = await req.json();

    if (!supplierIds || supplierIds.length === 0) {
      throw new Error('No supplier IDs provided');
    }

    console.log(`Starting bulk deletion for ${supplierIds.length} suppliers`);

    // Calculate total products to delete
    let totalProducts = 0;
    const supplierData: Array<{ id: string; name: string; productCount: number }> = [];
    
    for (const supplierId of supplierIds) {
      const { data: supplier } = await supabase
        .from('supplier_configurations')
        .select('name')
        .eq('id', supplierId)
        .single();

      const { count } = await supabase
        .from('supplier_products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', supplierId);

      const productCount = count || 0;
      totalProducts += productCount;
      
      supplierData.push({
        id: supplierId,
        name: supplier?.name || 'Unknown',
        productCount
      });
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('bulk_deletion_jobs')
      .insert({
        user_id: user.id,
        supplier_ids: supplierIds,
        status: 'processing',
        total_suppliers: supplierIds.length,
        total_products: totalProducts,
        completed_suppliers: 0,
        deleted_products: 0
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    console.log(`Job created: ${job.id}`);

    // Process deletions asynchronously
    processDeletersAsync(supabase, job.id, supplierData, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        total_suppliers: supplierIds.length,
        total_products: totalProducts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-delete-suppliers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fonction générique pour suppression en batch avec retry
async function deleteInBatches(
  supabase: any,
  table: string,
  filterField: string,
  filterValue: string,
  ids: string[],
  jobId: string,
  onProgress?: (deletedCount: number) => Promise<void>
): Promise<number> {
  let totalDeleted = 0;
  let batchCount = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    
    await retryWithBackoff(
      async () => {
        const { error } = await supabase
          .from(table)
          .delete()
          .in(filterField, batch);

        if (error) throw error;
      },
      3,
      1000,
      `Delete ${table} batch ${batchCount + 1}`
    );

    totalDeleted += batch.length;
    batchCount++;

    // Update progress every PROGRESS_UPDATE_INTERVAL batches
    if (batchCount % PROGRESS_UPDATE_INTERVAL === 0 && onProgress) {
      await onProgress(totalDeleted);
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Final progress update
  if (onProgress && totalDeleted > 0) {
    await onProgress(totalDeleted);
  }

  return totalDeleted;
}

async function processDeletersAsync(
  supabase: any,
  jobId: string,
  supplierData: Array<{ id: string; name: string; productCount: number }>,
  userId: string
) {
  let completedSuppliers = 0;
  let deletedProducts = 0;
  const errors: Array<{ supplier: string; error: string }> = [];

  try {
    for (const supplier of supplierData) {
      const supplierStartTime = Date.now();
      console.log(`Processing supplier: ${supplier.name} (${supplier.productCount} products)`);

      // Update current supplier
      await retryWithBackoff(
        async () => {
          await supabase
            .from('bulk_deletion_jobs')
            .update({
              current_supplier_id: supplier.id,
              current_supplier_name: supplier.name,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        },
        3,
        1000,
        'Update current supplier'
      );

      try {
        // 1. Get all product IDs for this supplier
        const { data: products } = await retryWithBackoff(
          async () => {
            const { data, error } = await supabase
              .from('supplier_products')
              .select('id')
              .eq('supplier_id', supplier.id);
            
            if (error) throw error;
            return { data };
          },
          3,
          1000,
          'Fetch product IDs'
        );

        if (!products || products.length === 0) {
          console.log(`No products found for ${supplier.name}`);
        } else {
          const productIds = products.map((p: any) => p.id);
          console.log(`Found ${productIds.length} products for ${supplier.name}`);

          // 2. Delete enrichment_queue entries (FIRST!)
          console.log('Deleting enrichment_queue entries...');
          await deleteInBatches(
            supabase,
            'enrichment_queue',
            'supplier_product_id',
            supplier.id,
            productIds,
            jobId
          );

          // 3. Delete product_links
          console.log('Deleting product_links...');
          const linksDeleted = await deleteInBatches(
            supabase,
            'product_links',
            'supplier_product_id',
            supplier.id,
            productIds,
            jobId,
            async (count) => {
              deletedProducts = count;
              await supabase
                .from('bulk_deletion_jobs')
                .update({
                  deleted_products: deletedProducts,
                  updated_at: new Date().toISOString()
                })
                .eq('id', jobId);
            }
          );
          console.log(`Deleted ${linksDeleted} product links`);

          // 4. Delete supplier_price_variants in batches
          console.log('Deleting supplier_price_variants...');
          const { data: variants } = await retryWithBackoff(
            async () => {
              const { data, error } = await supabase
                .from('supplier_price_variants')
                .select('id')
                .eq('supplier_id', supplier.id);
              
              if (error) throw error;
              return { data };
            },
            3,
            1000,
            'Fetch variant IDs'
          );

          if (variants && variants.length > 0) {
            const variantIds = variants.map((v: any) => v.id);
            console.log(`Found ${variantIds.length} price variants`);
            await deleteInBatches(
              supabase,
              'supplier_price_variants',
              'id',
              supplier.id,
              variantIds,
              jobId
            );
          }

          // 5. Delete supplier_products in batches
          console.log('Deleting supplier_products...');
          await deleteInBatches(
            supabase,
            'supplier_products',
            'id',
            supplier.id,
            productIds,
            jobId
          );
        }

        // 6. Delete email_inbox entries
        console.log('Deleting email_inbox entries...');
        await retryWithBackoff(
          async () => {
            const { error } = await supabase
              .from('email_inbox')
              .delete()
              .eq('detected_supplier_name', supplier.name);
            
            if (error) throw error;
          },
          3,
          1000,
          'Delete email_inbox'
        );

        // 7. Delete supplier configuration
        console.log('Deleting supplier configuration...');
        await retryWithBackoff(
          async () => {
            const { error } = await supabase
              .from('supplier_configurations')
              .delete()
              .eq('id', supplier.id);
            
            if (error) throw error;
          },
          3,
          1000,
          'Delete supplier configuration'
        );

        completedSuppliers++;
        const elapsed = Math.round((Date.now() - supplierStartTime) / 1000);
        console.log(`✅ Supplier ${supplier.name} deleted successfully in ${elapsed}s`);

        // Check timeout
        if (Date.now() - supplierStartTime > SUPPLIER_TIMEOUT_MS) {
          throw new Error(`Timeout: Supplier deletion took more than 10 minutes`);
        }

      } catch (error) {
        console.error(`❌ Error deleting supplier ${supplier.name}:`, error);
        errors.push({
          supplier: supplier.name,
          error: error.message
        });
      }

      // Update progress after each supplier
      await retryWithBackoff(
        async () => {
          await supabase
            .from('bulk_deletion_jobs')
            .update({
              completed_suppliers: completedSuppliers,
              deleted_products: deletedProducts,
              errors: errors,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
        },
        3,
        1000,
        'Update job progress'
      );
    }

    // Mark job as completed
    const finalStatus = errors.length === 0 ? 'completed' : 'completed_with_errors';
    await retryWithBackoff(
      async () => {
        await supabase
          .from('bulk_deletion_jobs')
          .update({
            status: finalStatus,
            completed_suppliers: completedSuppliers,
            deleted_products: deletedProducts,
            errors: errors,
            error_message: errors.length > 0 
              ? `${errors.length} fournisseur(s) n'ont pas pu être supprimés`
              : null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
      },
      3,
      1000,
      'Mark job as completed'
    );

    console.log(`✅ Job ${jobId} completed: ${completedSuppliers}/${supplierData.length} suppliers deleted`);

  } catch (error) {
    console.error('Fatal error in bulk deletion:', error);
    await supabase
      .from('bulk_deletion_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}
