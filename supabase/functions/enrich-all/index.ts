import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, productData, purchasePrice, preferred_model } = await req.json();
    console.log('[ENRICH-ALL] 🚀 Starting all enrichments for:', analysisId);
    console.log('[ENRICH-ALL] Preferred model:', preferred_model || 'auto');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Determine if RSGP should be included (only for physical products)
    const isPhysicalProduct = productData?.category?.toLowerCase().includes('electronic') || 
                              productData?.category?.toLowerCase().includes('appliance') ||
                              productData?.name?.toLowerCase().includes('phone') ||
                              productData?.name?.toLowerCase().includes('computer');

    // ✅ Call all enrichments in parallel using Promise.allSettled
    const enrichments = await Promise.allSettled([
      // 1. Specifications
      supabase.functions.invoke('enrich-specifications', {
        body: { analysisId, productData, preferred_model },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }),
      
      // 2. Technical Description
      supabase.functions.invoke('enrich-technical-description', {
        body: { analysisId, productData, preferred_model },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }),
      
      // 3. Cost Analysis
      supabase.functions.invoke('enrich-cost-analysis', {
        body: { analysisId, productData, purchasePrice, preferred_model },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }),
      
      // 4. RSGP (only if physical product)
      ...(isPhysicalProduct ? [
        supabase.functions.invoke('rsgp-compliance-generator', {
          body: { 
            analysis_id: analysisId, 
            force_regenerate: true, 
            preferred_model 
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
      ] : [])
    ]);

    // Build summary
    const summary = {
      specifications: enrichments[0].status === 'fulfilled' && enrichments[0].value.data?.success !== false ? 'completed' : 'failed',
      technical_description: enrichments[1].status === 'fulfilled' && enrichments[1].value.data?.success !== false ? 'completed' : 'failed',
      cost_analysis: enrichments[2].status === 'fulfilled' && enrichments[2].value.data?.success !== false ? 'completed' : 'failed',
      rsgp: isPhysicalProduct 
        ? (enrichments[3]?.status === 'fulfilled' && enrichments[3].value.data?.success !== false ? 'completed' : 'failed')
        : 'skipped'
    };

    // Log results
    console.log('[ENRICH-ALL] ✅ Summary:', summary);
    
    // Count successes
    const successCount = Object.values(summary).filter(s => s === 'completed').length;
    const failedCount = Object.values(summary).filter(s => s === 'failed').length;
    const skippedCount = Object.values(summary).filter(s => s === 'skipped').length;

    console.log(`[ENRICH-ALL] 📊 Results: ${successCount} completed, ${failedCount} failed, ${skippedCount} skipped`);

    // Extract providers used
    const providers = enrichments
      .filter((e): e is PromiseFulfilledResult<any> => e.status === 'fulfilled' && e.value.data?.provider)
      .map(e => e.value.data.provider);

    return new Response(
      JSON.stringify({ 
        success: true,
        summary,
        successCount,
        failedCount,
        skippedCount,
        providers: [...new Set(providers)]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ENRICH-ALL] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
