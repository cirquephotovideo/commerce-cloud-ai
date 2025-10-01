import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SalesforceConfig {
  platform_url: string;
  access_token_encrypted: string;
  additional_config?: {
    client_id?: string;
    client_secret?: string;
    username?: string;
  };
}

interface ProductAnalysis {
  id: string;
  analysis_result: any;
  mapped_category_id?: string;
  image_urls?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysis_ids } = await req.json();

    // Get Salesforce configuration
    const { data: config, error: configError } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'salesforce')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Salesforce configuration not found');
    }

    const salesforceConfig: SalesforceConfig = config;

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from('platform_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'salesforce')
      .eq('is_active', true);

    // Get pricing rules
    const { data: pricingRules } = await supabase
      .from('platform_pricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'salesforce')
      .eq('is_active', true);

    // Fetch product analyses
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('*')
      .in('id', analysis_ids);

    if (analysesError || !analyses) {
      throw new Error('Failed to fetch analyses');
    }

    const results = {
      success: 0,
      errors: 0,
      details: [] as any[],
    };

    // Export each product
    for (const analysis of analyses) {
      try {
        const productData = mapAnalysisToSalesforce(
          analysis,
          fieldMappings || [],
          pricingRules || []
        );

        const response = await fetch(`${salesforceConfig.platform_url}/services/data/v58.0/sobjects/Product2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${salesforceConfig.access_token_encrypted}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        });

        if (response.ok) {
          const createdProduct = await response.json();
          results.success++;
          results.details.push({
            analysis_id: analysis.id,
            status: 'success',
            product_id: createdProduct.id,
          });
        } else {
          const errorText = await response.text();
          results.errors++;
          results.details.push({
            analysis_id: analysis.id,
            status: 'error',
            error: errorText,
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          analysis_id: analysis.id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Log export
    await supabase.from('platform_export_logs').insert({
      user_id: user.id,
      platform_type: 'salesforce',
      products_count: analyses.length,
      success_count: results.success,
      error_count: results.errors,
      export_details: results.details,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in export-to-salesforce:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapAnalysisToSalesforce(
  analysis: ProductAnalysis,
  fieldMappings: any[],
  pricingRules: any[]
): any {
  const result = analysis.analysis_result;
  
  // Calculate price with rules
  let price = parseFloat(result.price?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0');
  
  for (const rule of pricingRules) {
    if (rule.markup_percentage) {
      price = price * (1 + rule.markup_percentage / 100);
    }
    if (rule.fixed_amount) {
      price += rule.fixed_amount;
    }
    
    if (rule.price_rounding_rule === 'round') {
      price = Math.round(price * 100) / 100;
    } else if (rule.price_rounding_rule === 'ceil') {
      price = Math.ceil(price * 100) / 100;
    } else if (rule.price_rounding_rule === 'floor') {
      price = Math.floor(price * 100) / 100;
    }
  }

  const productData: any = {
    Name: result.title || 'Product',
    Description: result.detailed_description || result.description || '',
    ProductCode: result.ean || result.upc || `PROD-${Date.now()}`,
    IsActive: true,
  };

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const sourceValue = getNestedValue(result, mapping.source_path);
    if (sourceValue !== undefined) {
      productData[mapping.platform_field] = sourceValue;
    }
  }

  return productData;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
