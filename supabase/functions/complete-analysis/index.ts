import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { generateFieldSpecificPrompt } from '../_shared/validation.ts';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

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

    console.log('[COMPLETE-ANALYSIS] Processing missing fields with intelligent retry:', missingFields);

    // Intelligent retry: process each missing field with a specific prompt
    const completionData: any = {};
    const processedFields: string[] = [];
    const failedFields: string[] = [];

    for (const field of missingFields) {
      try {
        console.log(`[COMPLETE-ANALYSIS] Processing field: ${field}`);
        
        // Generate field-specific prompt
        const fieldPrompt = generateFieldSpecificPrompt(
          field,
          { 
            product_name: analysis.analysis_result?.product_name,
            name: analysis.analysis_result?.product_name,
            category: analysis.analysis_result?.tags_categories?.primary_category
          },
          analysis.analysis_result
        );

        // Call AI with field-specific prompt
        const aiResponse = await callAIWithFallback({
          model: 'gpt-oss:20b-cloud',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en analyse e-commerce. Retourne UNIQUEMENT du JSON valide, sans markdown.'
            },
            {
              role: 'user',
              content: fieldPrompt
            }
          ],
          web_search: true,
          temperature: 0.7
        }, ['lovable_ai']);

        if (aiResponse.success) {
          // Parse the response
          let fieldData;
          try {
            fieldData = JSON.parse(aiResponse.content);
          } catch (parseError) {
            // Try to extract JSON
            const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              fieldData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('Could not parse field data');
            }
          }

          // Merge the field data into completionData
          if (field.includes('.')) {
            // Nested field (e.g., "seo.title")
            const parts = field.split('.');
            let current = completionData;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) current[parts[i]] = {};
              current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = fieldData[field] || fieldData[parts[parts.length - 1]] || fieldData;
          } else {
            // Top-level field
            completionData[field] = fieldData[field] || fieldData;
          }

          processedFields.push(field);
          console.log(`[COMPLETE-ANALYSIS] ✅ Field completed: ${field}`);
        } else {
          failedFields.push(field);
          console.error(`[COMPLETE-ANALYSIS] ❌ Failed to complete field: ${field}`);
        }
      } catch (error) {
        failedFields.push(field);
        console.error(`[COMPLETE-ANALYSIS] Error processing field ${field}:`, error);
      }
    }

    console.log('[COMPLETE-ANALYSIS] Completion summary:', {
      processed: processedFields.length,
      failed: failedFields.length,
      total: missingFields.length
    });

    // Deep merge completion data with existing analysis
    const deepMerge = (target: any, source: any): any => {
      const output = { ...target };
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
      return output;
    };

    const updatedAnalysis = deepMerge(analysis.analysis_result, {
      ...completionData,
      _incomplete: failedFields.length > 0,
      _missing_fields: failedFields,
      _needs_reanalysis: failedFields.length > 0,
      _completed_at: new Date().toISOString(),
      _retry_summary: {
        processed: processedFields,
        failed: failedFields,
        timestamp: new Date().toISOString()
      }
    });

    // Update database
    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({ 
        analysis_result: updatedAnalysis,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) throw updateError;

    const completionStatus = failedFields.length === 0 ? 'fully completed' : 'partially completed';
    console.log(`[COMPLETE-ANALYSIS] ✅ Analysis ${completionStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Analysis ${completionStatus}`,
        processedFields,
        failedFields,
        completeness: Math.round((processedFields.length / missingFields.length) * 100)
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
