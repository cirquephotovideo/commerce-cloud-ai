import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrestaShopConfig {
  platform_url: string;
  api_key_encrypted: string;
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

    // Get PrestaShop configuration
    const { data: config, error: configError } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'prestashop')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('PrestaShop configuration not found');
    }

    const prestaConfig: PrestaShopConfig = config;

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from('platform_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'prestashop')
      .eq('is_active', true);

    // Get categories
    const { data: categories } = await supabase
      .from('platform_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'prestashop');

    // Get pricing rules
    const { data: pricingRules } = await supabase
      .from('platform_pricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'prestashop')
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
        const productData = mapAnalysisToPrestaShop(
          analysis,
          categories || [],
          fieldMappings || [],
          pricingRules || []
        );

        const response = await fetch(`${prestaConfig.platform_url}/api/products`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(prestaConfig.api_key_encrypted + ':')}`,
            'Content-Type': 'application/xml',
          },
          body: productData,
        });

        if (response.ok) {
          const responseText = await response.text();
          results.success++;
          results.details.push({
            analysis_id: analysis.id,
            status: 'success',
            response: responseText,
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
      platform_type: 'prestashop',
      products_count: analyses.length,
      success_count: results.success,
      error_count: results.errors,
      export_details: results.details,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in export-to-prestashop:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapAnalysisToPrestaShop(
  analysis: ProductAnalysis,
  categories: any[],
  fieldMappings: any[],
  pricingRules: any[]
): string {
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

  const categoryId = analysis.mapped_category_id || '2';
  const name = escapeXml(result.title || 'Product');
  const description = escapeXml(result.detailed_description || result.description || '');
  const reference = escapeXml(result.ean || result.upc || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <name><language id="1"><![CDATA[${name}]]></language></name>
    <description><language id="1"><![CDATA[${description}]]></language></description>
    <price>${price.toFixed(2)}</price>
    <id_category_default>${categoryId}</id_category_default>
    <reference><![CDATA[${reference}]]></reference>
    <active>1</active>
    <available_for_order>1</available_for_order>
  </product>
</prestashop>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
