import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UberEatsConfig {
  platform_url: string;
  api_key_encrypted: string;
  api_secret_encrypted: string;
}

interface ProductAnalysis {
  id: string;
  analysis_result: any;
  mapped_category_id?: string;
  mapped_category_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { analysis_ids } = await req.json();

    // Get Uber Eats configuration
    const { data: config, error: configError } = await supabaseClient
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'uber_eats')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Uber Eats configuration not found');
    }

    // Get field mappings
    const { data: fieldMappings } = await supabaseClient
      .from('platform_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'uber_eats')
      .eq('is_active', true);

    // Get pricing rules
    const { data: pricingRules } = await supabaseClient
      .from('platform_pricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'uber_eats')
      .eq('is_active', true);

    // Get product analyses
    const { data: analyses, error: analysesError } = await supabaseClient
      .from('product_analyses')
      .select('*')
      .in('id', analysis_ids)
      .eq('user_id', user.id);

    if (analysesError) throw analysesError;

    const results = [];
    for (const analysis of analyses) {
      try {
        const productData = mapAnalysisToUberEats(analysis, fieldMappings || [], pricingRules || [], config);

        // Post to Uber Eats API
        const response = await fetch(`${config.platform_url}/api/v1/menu/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.api_key_encrypted}`,
            'X-API-Secret': config.api_secret_encrypted
          },
          body: JSON.stringify(productData)
        });

        if (!response.ok) {
          throw new Error(`Uber Eats API error: ${response.statusText}`);
        }

        const result = await response.json();
        results.push({ analysis_id: analysis.id, success: true, uber_eats_id: result.id });

        // Log successful export
        await supabaseClient.from('platform_export_logs').insert({
          user_id: user.id,
          platform_type: 'uber_eats',
          products_count: 1,
          success_count: 1,
          error_count: 0,
          export_details: { analysis_id: analysis.id, uber_eats_id: result.id }
        });
      } catch (error) {
        console.error(`Error exporting analysis ${analysis.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ analysis_id: analysis.id, success: false, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapAnalysisToUberEats(
  analysis: ProductAnalysis,
  fieldMappings: any[],
  pricingRules: any[],
  config: UberEatsConfig
): any {
  const analysisData = analysis.analysis_result;

  // Apply pricing rules
  let finalPrice = parseFloat(analysisData.price_estimation?.estimated_price || 0);
  for (const rule of pricingRules) {
    if (rule.markup_percentage) {
      finalPrice *= (1 + rule.markup_percentage / 100);
    }
    if (rule.fixed_amount) {
      finalPrice += parseFloat(rule.fixed_amount);
    }
  }

  const productData: any = {
    title: analysisData.basic_info?.product_name || 'Unnamed Product',
    description: analysisData.seo_content?.product_description || '',
    price: finalPrice.toFixed(2),
    category: analysis.mapped_category_name || 'General',
    availability: true
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const value = getNestedValue(analysisData, mapping.source_path);
    if (value !== undefined) {
      productData[mapping.platform_field] = value;
    }
  }

  return productData;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
