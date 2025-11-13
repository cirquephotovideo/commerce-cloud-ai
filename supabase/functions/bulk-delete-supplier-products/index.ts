import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteProductsRequest {
  productIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { productIds }: DeleteProductsRequest = await req.json();

    if (!productIds || productIds.length === 0) {
      throw new Error('No product IDs provided');
    }

    console.log(`Starting bulk deletion for ${productIds.length} products`);

    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(productIds.length / BATCH_SIZE);

    const { data: job, error: jobError } = await supabase
      .from('bulk_product_deletion_jobs')
      .insert({
        user_id: user.id,
        product_ids: productIds,
        status: 'processing',
        total_products: productIds.length,
        total_batches: totalBatches,
        deleted_products: 0,
        deleted_links: 0,
        deleted_variants: 0
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    console.log(`Job created: ${job.id}`);

    processDeleteProductsAsync(supabase, job.id, productIds, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        total_products: productIds.length,
        total_batches: totalBatches
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-delete-supplier-products:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processDeleteProductsAsync(
  supabase: any,
  jobId: string,
  productIds: string[],
  userId: string
) {
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(productIds.length / BATCH_SIZE);
  let deletedProducts = 0;
  let deletedLinks = 0;
  let deletedVariants = 0;
  const errors: Array<{ batch: number; error: string }> = [];

  try {
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = productIds.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

      try {
        const { error: linksError, count: linksCount } = await supabase
          .from('product_links')
          .delete({ count: 'exact' })
          .in('supplier_product_id', batch);

        if (linksError) {
          console.error(`Error deleting links for batch ${batchNumber}:`, linksError);
        } else {
          deletedLinks += linksCount || 0;
        }

        const { error: variantsError, count: variantsCount } = await supabase
          .from('supplier_price_variants')
          .delete({ count: 'exact' })
          .in('supplier_product_id', batch);

        if (variantsError) {
          console.error(`Error deleting variants for batch ${batchNumber}:`, variantsError);
        } else {
          deletedVariants += variantsCount || 0;
        }

        await supabase
          .from('enrichment_queue')
          .delete()
          .in('supplier_product_id', batch);

        const { error: productsError, count: productsCount } = await supabase
          .from('supplier_products')
          .delete({ count: 'exact' })
          .in('id', batch);

        if (productsError) {
          throw productsError;
        }

        deletedProducts += productsCount || 0;
        console.log(`✅ Batch ${batchNumber} deleted: ${productsCount} products`);

      } catch (batchError) {
        console.error(`❌ Error in batch ${batchNumber}:`, batchError);
        errors.push({
          batch: batchNumber,
          error: batchError.message
        });
      }

      await supabase
        .from('bulk_product_deletion_jobs')
        .update({
          current_batch: batchNumber,
          deleted_products: deletedProducts,
          deleted_links: deletedLinks,
          deleted_variants: deletedVariants,
          errors: errors,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalStatus = errors.length === 0 ? 'completed' : 'completed_with_errors';
    await supabase
      .from('bulk_product_deletion_jobs')
      .update({
        status: finalStatus,
        deleted_products: deletedProducts,
        deleted_links: deletedLinks,
        deleted_variants: deletedVariants,
        errors: errors,
        error_message: errors.length > 0 
          ? `${errors.length} lot(s) ont échoué`
          : null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`✅ Job ${jobId} completed: ${deletedProducts}/${productIds.length} products deleted`);

  } catch (error) {
    console.error('Fatal error in bulk product deletion:', error);
    await supabase
      .from('bulk_product_deletion_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}
