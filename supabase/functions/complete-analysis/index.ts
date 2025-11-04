import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId } = await req.json();
    
    if (!analysisId) {
      throw new Error('analysisId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('product_analyses')
      .select('*, analysis_result')
      .eq('id', analysisId)
      .single();

    if (fetchError || !analysis) {
      throw new Error('Analysis not found');
    }

    console.log('[COMPLETE-ANALYSIS] Current analysis:', {
      id: analysisId,
      has_incomplete_flag: analysis.analysis_result?._incomplete,
      missing_fields: analysis.analysis_result?._missing_fields || []
    });

    const missingFields = analysis.analysis_result?._missing_fields || [];
    
    if (missingFields.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analysis is already complete' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build targeted prompt for missing sections
    const targetedPrompt = `
Complete the missing analysis fields for this product:

Product Name: ${analysis.analysis_result?.product_name || 'Unknown'}
Current Data: ${JSON.stringify(analysis.analysis_result, null, 2)}

Missing Fields: ${missingFields.join(', ')}

Please provide ONLY the missing data in valid JSON format. Focus on:
${missingFields.map(f => `- ${f}`).join('\n')}

Return a JSON object with ONLY these fields filled in.
`;

    // Call AI to complete missing sections
    const { data: aiData, error: aiError } = await supabase.functions.invoke('ollama-proxy', {
      body: {
        model: 'qwen2.5:32b',
        prompt: targetedPrompt,
        temperature: 0.7,
        web_search: true
      }
    });

    if (aiError) throw aiError;

    let completionData;
    try {
      const content = aiData.content || aiData.response;
      completionData = JSON.parse(content);
    } catch (parseError) {
      console.error('[COMPLETE-ANALYSIS] Parse error:', parseError);
      // Try to extract JSON
      const jsonMatch = (aiData.content || aiData.response).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        completionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse completion data');
      }
    }

    // Merge completion data with existing analysis
    const updatedAnalysis = {
      ...analysis.analysis_result,
      ...completionData,
      _incomplete: false,
      _missing_fields: [],
      _needs_reanalysis: false,
      _completed_at: new Date().toISOString()
    };

    // Update database
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({ 
        analysis_result: updatedAnalysis,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    console.log('[COMPLETE-ANALYSIS] ✅ Analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analysis completed successfully',
        updatedFields: missingFields
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[COMPLETE-ANALYSIS] Error:', error);
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
