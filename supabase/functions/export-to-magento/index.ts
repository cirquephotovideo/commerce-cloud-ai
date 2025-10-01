import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MagentoConfig {
  platform_url: string;
  access_token_encrypted: string;
  additional_config?: {
    store_code?: string;
    attribute_set_id?: string;
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

    // Get Magento configuration
    const { data: config, error: configError } = await supabase
      .from('platform_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'magento')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      throw new Error('Magento configuration not found');
    }

    const magentoConfig: MagentoConfig = config;

    // Get field mappings
    const { data: fieldMappings } = await supabase
      .from('platform_field_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'magento')
      .eq('is_active', true);

    // Get categories
    const { data: categories } = await supabase
      .from('platform_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'magento');

    // Get pricing rules
    const { data: pricingRules } = await supabase
      .from('platform_pricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform_type', 'magento')
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
        const productData = mapAnalysisToMagento(
          analysis,
          categories || [],
          fieldMappings || [],
          pricingRules || [],
          magentoConfig
        );

        const response = await fetch(`${magentoConfig.platform_url}/rest/V1/products`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${magentoConfig.access_token_encrypted}`,
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
      platform_type: 'magento',
      products_count: analyses.length,
      success_count: results.success,
      error_count: results.errors,
      export_details: results.details,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in export-to-magento:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapAnalysisToMagento(
  analysis: ProductAnalysis,
  categories: any[],
  fieldMappings: any[],
  pricingRules: any[],
  config: MagentoConfig
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

  const sku = result.ean || result.upc || `SKU-${Date.now()}`;
  const attributeSetId = config.additional_config?.attribute_set_id || '4';

  const productData: any = {
    product: {
      sku: sku,
      name: result.title || 'Product',
      attribute_set_id: parseInt(attributeSetId),
      price: price,
      status: 1,
      visibility: 4,
      type_id: 'simple',
      weight: 1,
      extension_attributes: {
        stock_item: {
          qty: 0,
          is_in_stock: false,
        },
      },
    },
  };

  // Add custom attributes
  const customAttributes = [];

  if (result.detailed_description || result.description) {
    customAttributes.push({
      attribute_code: 'description',
      value: result.detailed_description || result.description,
    });
  }

  if (analysis.mapped_category_id && categories.length > 0) {
    const categoryIds = [analysis.mapped_category_id];
    customAttributes.push({
      attribute_code: 'category_ids',
      value: categoryIds,
    });
  }

  if (customAttributes.length > 0) {
    productData.product.custom_attributes = customAttributes;
  }

  // Apply custom field mappings
  for (const mapping of fieldMappings) {
    const sourceValue = getNestedValue(result, mapping.source_path);
    if (sourceValue !== undefined) {
      setNestedValue(productData.product, mapping.platform_field, sourceValue);
    }
  }

  return productData;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}
