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

    // Get user ID from token
    const { data: { user } } = await supabase.auth.getUser(token);
    const userId = user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Determine if RSGP should be included (only for physical products)
    const isPhysicalProduct = productData?.category?.toLowerCase().includes('electronic') || 
                              productData?.category?.toLowerCase().includes('appliance') ||
                              productData?.name?.toLowerCase().includes('phone') ||
                              productData?.name?.toLowerCase().includes('computer');

    // Define enrichment types
    const enrichmentTypes = [
      'specifications',
      'technical_description',
      'cost_analysis',
      ...(isPhysicalProduct ? ['rsgp'] : [])
    ];

    // Create pending tasks in enrichment_queue
    console.log('[ENRICH-ALL] Creating tasks in enrichment_queue:', enrichmentTypes);
    for (const type of enrichmentTypes) {
      await supabase
        .from('enrichment_queue')
        .insert({
          user_id: userId,
          analysis_id: analysisId,
          enrichment_type: [type],
          status: 'pending',
          priority: 'normal'
        });
    }

    // ✅ Call enrichments sequentially to track progress
    const enrichments: Array<{ type: string; result: any }> = [];

    // 1. Specifications
    console.log('[ENRICH-ALL] 🔄 Starting specifications...');
    await supabase
      .from('enrichment_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['specifications']);

    const specsResult = await supabase.functions.invoke('enrich-specifications', {
      body: { analysisId, productData, preferred_model },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    await supabase
      .from('enrichment_queue')
      .update({ 
        status: specsResult.error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: specsResult.error?.message || null
      })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['specifications']);

    enrichments.push({ type: 'specifications', result: specsResult });

    // 2. Technical Description
    console.log('[ENRICH-ALL] 🔄 Starting technical_description...');
    await supabase
      .from('enrichment_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['technical_description']);

    const techResult = await supabase.functions.invoke('enrich-technical-description', {
      body: { analysisId, productData, preferred_model },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    await supabase
      .from('enrichment_queue')
      .update({ 
        status: techResult.error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: techResult.error?.message || null
      })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['technical_description']);

    enrichments.push({ type: 'technical_description', result: techResult });

    // 3. Cost Analysis
    console.log('[ENRICH-ALL] 🔄 Starting cost_analysis...');
    await supabase
      .from('enrichment_queue')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['cost_analysis']);

    const costResult = await supabase.functions.invoke('enrich-cost-analysis', {
      body: { analysisId, productData, purchasePrice, preferred_model },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    await supabase
      .from('enrichment_queue')
      .update({ 
        status: costResult.error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: costResult.error?.message || null
      })
      .eq('analysis_id', analysisId)
      .eq('enrichment_type', ['cost_analysis']);

    enrichments.push({ type: 'cost_analysis', result: costResult });

    // 4. RSGP (only if physical product)
    if (isPhysicalProduct) {
      console.log('[ENRICH-ALL] 🔄 Starting rsgp...');
      await supabase
        .from('enrichment_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('analysis_id', analysisId)
        .eq('enrichment_type', ['rsgp']);

      const rsgpResult = await supabase.functions.invoke('rsgp-compliance-generator', {
        body: { 
          analysis_id: analysisId, 
          force_regenerate: true, 
          preferred_model 
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      await supabase
        .from('enrichment_queue')
        .update({ 
          status: rsgpResult.error ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          error_message: rsgpResult.error?.message || null
        })
        .eq('analysis_id', analysisId)
        .eq('enrichment_type', ['rsgp']);

      enrichments.push({ type: 'rsgp', result: rsgpResult });
    }

    // Build summary
    const summary: Record<string, string> = {};
    enrichments.forEach(({ type, result }) => {
      summary[type] = result.error ? 'failed' : 'completed';
    });

    // Log results
    console.log('[ENRICH-ALL] ✅ Summary:', summary);
    
    // Count successes
    const successCount = Object.values(summary).filter(s => s === 'completed').length;
    const failedCount = Object.values(summary).filter(s => s === 'failed').length;
    const skippedCount = enrichmentTypes.length - enrichments.length;

    console.log(`[ENRICH-ALL] 📊 Results: ${successCount} completed, ${failedCount} failed, ${skippedCount} skipped`);

    // Extract providers used
    const providers = enrichments
      .filter(({ result }) => result.data?.provider)
      .map(({ result }) => result.data.provider);

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
