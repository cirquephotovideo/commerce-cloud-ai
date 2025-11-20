import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  userId: string;
  resyncOdoo?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { userId, resyncOdoo = true }: CleanupRequest = await req.json();

    console.log('🧹 Starting cleanup for user:', userId);

    // 1. Merge duplicate analyses by EAN (with timeout tolerance)
    console.log('📊 Step 1: Merging duplicate analyses...');
    let mergeResult: any = null;
    
    try {
      const { data, error: mergeError } = await supabaseClient
        .rpc('merge_duplicate_analyses_by_ean', { p_user_id: userId });

      if (mergeError) {
        // Check if it's a SQL timeout (code 57014)
        if (mergeError.code === '57014' || mergeError.message?.includes('timeout')) {
          console.warn('⚠️ Merge timed out, continuing with partial cleanup', mergeError);
          mergeResult = { 
            success: false, 
            partial: true, 
            merged_eans: 0, 
            deleted_analyses: 0,
            reason: 'timeout' 
          };
        } else {
          console.error('❌ Merge error:', mergeError);
          throw mergeError;
        }
      } else {
        mergeResult = data;
        console.log('✅ Merge result:', mergeResult);
      }
    } catch (error: any) {
      // Handle unexpected errors during merge
      if (error.code === '57014' || error.message?.includes('timeout')) {
        console.warn('⚠️ Merge exception (timeout), continuing with partial cleanup', error);
        mergeResult = { 
          success: false, 
          partial: true, 
          merged_eans: 0, 
          deleted_analyses: 0,
          reason: 'timeout' 
        };
      } else {
        throw error;
      }
    }

    // 2. Rebuild supplier_price_variants from product_links
    console.log('🔗 Step 2: Rebuilding supplier_price_variants...');

    let variantsCreated = 0;
    let processedLinks = 0;
    const pageSize = 500; // Process 500 links at a time
    let hasMore = true;

    while (hasMore) {
      const { data: links, error: linksError } = await supabaseClient
        .from('product_links')
        .select(`
          analysis_id,
          supplier_product_id,
          supplier_products(
            id,
            supplier_id,
            purchase_price,
            stock_quantity,
            user_id
          )
        `)
        .eq('supplier_products.user_id', userId)
        .range(processedLinks, processedLinks + pageSize - 1);

      if (linksError) {
        console.error('❌ Links fetch error:', linksError);
        throw linksError;
      }

      if (!links || links.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📋 Processing ${links.length} links (batch ${Math.floor(processedLinks / pageSize) + 1})`);

      // Batch upsert (100 at a time)
      const batchSize = 100;
      for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        
        const variantsToUpsert = batch
          .filter(link => link.supplier_products)
          .map(link => {
            const sp = link.supplier_products as any;
            return {
              analysis_id: link.analysis_id,
              supplier_product_id: link.supplier_product_id,
              supplier_id: sp.supplier_id,
              purchase_price: sp.purchase_price || 0,
              stock_quantity: sp.stock_quantity || 0,
              currency: 'EUR',
              user_id: sp.user_id,
              last_updated: new Date().toISOString(),
            };
          });

        if (variantsToUpsert.length > 0) {
          const { error: variantError } = await supabaseClient
            .from('supplier_price_variants')
            .upsert(variantsToUpsert, {
              onConflict: 'analysis_id,supplier_product_id',
            });

          if (!variantError) {
            variantsCreated += variantsToUpsert.length;
          } else {
            console.error(`❌ Upsert error:`, variantError);
            // Continue même en cas d'erreur partielle
          }
        }
      }

      processedLinks += links.length;
      hasMore = links.length === pageSize;
    }

    console.log(`✅ Created/updated ${variantsCreated} supplier price variants from ${processedLinks} links`);

    // 3. Resync Odoo products if requested
    let odooSyncResults = null;
    if (resyncOdoo) {
      console.log('🔄 Step 3: Re-syncing Odoo products...');
      
      const { data: odooProducts, error: odooError } = await supabaseClient
        .from('supplier_products')
        .select('id, supplier_id, supplier_reference, supplier_configurations(supplier_type)')
        .eq('user_id', userId)
        .eq('supplier_configurations.supplier_type', 'odoo')
        .limit(100); // Augmenté de 50 à 100

      if (odooError) {
        console.warn('⚠️ Odoo products fetch error (non-critical):', odooError);
        odooSyncResults = { error: odooError.message, synced: 0 };
      } else if (odooProducts && odooProducts.length > 0) {
        console.log(`📦 Found ${odooProducts.length} Odoo products to sync`);
        
        const syncPromises = odooProducts.map(async (product: any) => {
          try {
            const { error: syncError } = await supabaseClient.functions.invoke(
              'supplier-sync-single-product',
              {
                body: { productId: product.id },
              }
            );
            
            if (syncError) {
              console.warn(`⚠️ Sync failed for ${product.id}:`, syncError.message);
              return { success: false, productId: product.id, error: syncError.message };
            }
            
            return { success: true, productId: product.id };
          } catch (err) {
            console.warn(`⚠️ Sync exception for ${product.id}:`, err);
            return { success: false, productId: product.id, error: String(err) };
          }
        });

        odooSyncResults = await Promise.all(syncPromises);
        const successCount = odooSyncResults.filter(r => r.success).length;
        console.log(`✅ Synced ${successCount}/${odooProducts.length} Odoo products`);
      } else {
        console.log('ℹ️ No Odoo products found to sync');
        odooSyncResults = { synced: 0, message: 'No Odoo products found' };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mergeResult,
        variantsCreated,
        odooSyncResults,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
