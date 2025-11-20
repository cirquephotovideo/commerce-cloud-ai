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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { userId, resyncOdoo = true }: CleanupRequest = await req.json();

    console.log('🧹 Starting cleanup for user:', userId);

    // 1. Merge duplicate analyses by EAN
    console.log('📊 Step 1: Merging duplicate analyses...');
    const { data: mergeResult, error: mergeError } = await supabaseClient
      .rpc('merge_duplicate_analyses_by_ean', { p_user_id: userId });

    if (mergeError) {
      console.error('❌ Merge error:', mergeError);
      throw mergeError;
    }

    console.log('✅ Merge result:', mergeResult);

    // 2. Rebuild supplier_price_variants from product_links
    console.log('🔗 Step 2: Rebuilding supplier_price_variants...');
    
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
      .eq('supplier_products.user_id', userId);

    if (linksError) {
      console.error('❌ Links fetch error:', linksError);
      throw linksError;
    }

    console.log(`📋 Found ${links?.length || 0} links to rebuild`);

    // Batch insert/update supplier_price_variants (100 at a time)
    let variantsCreated = 0;
    const batchSize = 100;
    
    for (let i = 0; i < (links?.length || 0); i += batchSize) {
      const batch = links!.slice(i, i + batchSize);
      
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
        const { error: variantError, data } = await supabaseClient
          .from('supplier_price_variants')
          .upsert(variantsToUpsert, {
            onConflict: 'analysis_id,supplier_product_id',
          });

        if (!variantError) {
          variantsCreated += variantsToUpsert.length;
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${variantsToUpsert.length} variants upserted`);
        } else {
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, variantError);
        }
      }
    }

    console.log(`✅ Created/updated ${variantsCreated} supplier price variants`);

    // 3. Resync Odoo products if requested
    let odooSyncResults = null;
    if (resyncOdoo) {
      console.log('🔄 Step 3: Re-syncing Odoo products...');
      
      const { data: odooProducts, error: odooError } = await supabaseClient
        .from('supplier_products')
        .select('id, supplier_id, supplier_reference, supplier_configurations(supplier_type)')
        .eq('user_id', userId)
        .eq('supplier_configurations.supplier_type', 'odoo')
        .limit(50);

      if (odooError) {
        console.error('⚠️ Odoo products fetch error:', odooError);
      } else {
        console.log(`📦 Found ${odooProducts?.length || 0} Odoo products to sync`);
        
        const syncPromises = (odooProducts || []).map(async (product: any) => {
          try {
            const { error: syncError } = await supabaseClient.functions.invoke(
              'supplier-sync-single-product',
              {
                body: { productId: product.id },
              }
            );
            
            if (syncError) {
              console.error(`❌ Sync failed for ${product.id}:`, syncError);
              return { success: false, productId: product.id, error: syncError.message };
            }
            
            return { success: true, productId: product.id };
          } catch (err) {
            console.error(`❌ Sync exception for ${product.id}:`, err);
            return { success: false, productId: product.id, error: String(err) };
          }
        });

        odooSyncResults = await Promise.all(syncPromises);
        const successCount = odooSyncResults.filter(r => r.success).length;
        console.log(`✅ Synced ${successCount}/${odooProducts.length} Odoo products`);
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
