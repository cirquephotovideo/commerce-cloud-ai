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

    // Call the appropriate export function
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

    return new Response(
      JSON.stringify({ 
        success: true, 
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