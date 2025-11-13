import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      console.log(`Processing supplier: ${supplier.name} (${supplier.productCount} products)`);

      // Update current supplier
      await supabase
        .from('bulk_deletion_jobs')
        .update({
          current_supplier_id: supplier.id,
          current_supplier_name: supplier.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      try {
        // 1. Delete product_links in batches
        const BATCH_SIZE = 500;
        const { data: products } = await supabase
          .from('supplier_products')
          .select('id')
          .eq('supplier_id', supplier.id);

        if (products && products.length > 0) {
          const productIds = products.map((p: any) => p.id);
          
          for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
            const batch = productIds.slice(i, i + BATCH_SIZE);
            
            await supabase
              .from('product_links')
              .delete()
              .in('supplier_product_id', batch);

            deletedProducts += batch.length;
            
            // Update progress
            await supabase
              .from('bulk_deletion_jobs')
              .update({
                deleted_products: deletedProducts,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);
          }
        }

        // 2. Delete supplier_price_variants
        await supabase
          .from('supplier_price_variants')
          .delete()
          .eq('supplier_id', supplier.id);

        // 3. Delete supplier_products in batches
        let remainingProducts = supplier.productCount;
        while (remainingProducts > 0) {
          const { error: deleteError } = await supabase
            .from('supplier_products')
            .delete()
            .eq('supplier_id', supplier.id)
            .limit(BATCH_SIZE);

          if (deleteError) {
            console.error(`Error deleting products for ${supplier.name}:`, deleteError);
            break;
          }

          remainingProducts -= BATCH_SIZE;
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 4. Delete email_inbox entries
        await supabase
          .from('email_inbox')
          .delete()
          .eq('detected_supplier_name', supplier.name);

        // 5. Delete supplier configuration
        const { error: supplierDeleteError } = await supabase
          .from('supplier_configurations')
          .delete()
          .eq('id', supplier.id);

        if (supplierDeleteError) {
          throw supplierDeleteError;
        }

        completedSuppliers++;
        console.log(`✅ Supplier ${supplier.name} deleted successfully`);

      } catch (error) {
        console.error(`❌ Error deleting supplier ${supplier.name}:`, error);
        errors.push({
          supplier: supplier.name,
          error: error.message
        });
      }

      // Update progress after each supplier
      await supabase
        .from('bulk_deletion_jobs')
        .update({
          completed_suppliers: completedSuppliers,
          deleted_products: deletedProducts,
          errors: errors,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }

    // Mark job as completed
    const finalStatus = errors.length === 0 ? 'completed' : 'completed_with_errors';
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
