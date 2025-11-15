import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { analysis_id, platform } = await req.json();

    if (!analysis_id || !platform) {
      throw new Error('Missing analysis_id or platform');
    }

    console.log(`[EXPORT] Starting export for analysis ${analysis_id} to platform ${platform}`);

    // Get the product analysis
    const { data: analysis, error: analysisError } = await supabaseClient
      .from('product_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (analysisError || !analysis) {
      throw new Error('Analysis not found');
    }

    console.log(`[EXPORT] Found product: ${analysis.name}`);

    // ÉTAPE 1: VALIDATION PRÉ-EXPORT
    console.log(`[EXPORT] Step 1: Pre-export validation`);
    const { data: validationResult, error: validationError } = await supabaseClient.functions.invoke(
      'validate-pre-export',
      { body: { analysis_id } }
    );

    if (validationError) {
      console.error('[EXPORT] Validation error:', validationError);
    }

    // ÉTAPE 2: ENRICHISSEMENT POST-PROD SI NÉCESSAIRE
    if (validationResult && validationResult.completeness_score < 80) {
      console.log(`[EXPORT] Step 2: Post-production enrichment (score: ${validationResult.completeness_score}%)`);
      console.log(`[EXPORT] Missing fields:`, validationResult.missing_fields);

      const { data: enrichmentResult, error: enrichmentError } = await supabaseClient.functions.invoke(
        'post-prod-enrichment',
        {
          body: {
            analysis_id,
            missing_fields: validationResult.missing_fields,
            target_platform: platform
          }
        }
      );

      if (enrichmentError) {
        console.warn('[EXPORT] Enrichment warning:', enrichmentError);
      } else {
        console.log(`[EXPORT] Enrichment completed: ${enrichmentResult?.completed_count || 0}/${enrichmentResult?.total_tasks || 0} tasks`);
      }
    } else {
      console.log(`[EXPORT] Product is complete (${validationResult?.completeness_score || 100}%), skipping enrichment`);
    }

    // ÉTAPE 3: EXPORT VERS LA PLATEFORME
    console.log(`[EXPORT] Step 3: Exporting to ${platform}`);
    const exportFunction = `export-to-${platform}`;
    const { data: exportResult, error: exportError } = await supabaseClient.functions.invoke(
      exportFunction,
      {
        body: {
          analysis_ids: [analysis_id]
        }
      }
    );

    if (exportError) {
      throw exportError;
    }

    console.log(`[EXPORT] Export completed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        validation: validationResult,
        result: exportResult,
        platform 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in export-single-product:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});