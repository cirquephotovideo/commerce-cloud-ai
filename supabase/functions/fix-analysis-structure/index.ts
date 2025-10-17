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
    console.log('[FIX-ANALYSIS-STRUCTURE] Starting migration to flatten analysis_result.analysis structure');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Phase 6: Fetch all product_analyses with nested "analysis" structure
    const { data: analyses, error: fetchError } = await supabase
      .from('product_analyses')
      .select('id, analysis_result')
      .not('analysis_result', 'is', null);

    if (fetchError) throw fetchError;

    console.log(`[FIX-ANALYSIS-STRUCTURE] Found ${analyses?.length || 0} analyses to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Check and fix each analysis
    for (const analysis of analyses || []) {
      const currentResult = analysis.analysis_result || {};
      
      // Check if data is wrapped in "analysis" key (old incorrect structure)
      if (currentResult.analysis && typeof currentResult.analysis === 'object') {
        console.log(`[FIX-ANALYSIS-STRUCTURE] 🔧 Flattening structure for analysis ${analysis.id}`);
        
        // Flatten: Move everything from analysis_result.analysis to analysis_result root
        const flattenedResult = {
          ...currentResult.analysis,  // Move nested data to root
          // Keep metadata fields if they exist at root level
          _provider: currentResult._provider,
          _model: currentResult._model,
          _timestamp: currentResult._timestamp,
          imageUrls: currentResult.imageUrls || currentResult.analysis.imageUrls,
          metadata: currentResult.metadata,
          usedProvider: currentResult.usedProvider,
          _fixed_at: new Date().toISOString()
        };

        // Update the database
        const { error: updateError } = await supabase
          .from('product_analyses')
          .update({ analysis_result: flattenedResult })
          .eq('id', analysis.id);

        if (updateError) {
          console.error(`[FIX-ANALYSIS-STRUCTURE] ❌ Failed to update ${analysis.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`[FIX-ANALYSIS-STRUCTURE] ✅ Updated ${analysis.id}`);
        }
      } else {
        // Structure is already correct (data at root level)
        skippedCount++;
      }
    }

    console.log(`[FIX-ANALYSIS-STRUCTURE] Migration complete: ${updatedCount} flattened, ${skippedCount} skipped (already correct)`);

    return new Response(
      JSON.stringify({ 
        success: true,
        updated: updatedCount,
        skipped: skippedCount,
        total: analyses?.length || 0,
        message: `Successfully flattened ${updatedCount} analysis structures. ${skippedCount} were already in correct format.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[FIX-ANALYSIS-STRUCTURE] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

