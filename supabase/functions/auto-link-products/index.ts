import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - levenshteinDistance(longer, shorter)) / longerLength;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { analysis_id, auto_mode = false } = await req.json();

    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'Missing analysis_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: analysis, error: analysisError } = await supabase
      .from('product_analyses')
      .select('ean, analysis_result')
      .eq('id', analysis_id)
      .single();

    if (analysisError || !analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const productEAN = analysis.ean;
    const productName = analysis.analysis_result?.name || '';
    const productBrand = analysis.analysis_result?.brand || '';
    const productModel = analysis.analysis_result?.model || '';

    const { data: supplierProducts, error: supplierError } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('user_id', user.id);

    if (supplierError) throw supplierError;

    interface Match {
      supplier_product_id: string;
      confidence_score: number;
      match_type: string;
      supplier_product: any;
    }

    const matches: Match[] = [];

    for (const sp of supplierProducts || []) {
      let score = 0;
      let matchType = '';

      if (sp.ean && productEAN && sp.ean.toLowerCase() === productEAN.toLowerCase()) {
        score = 100;
        matchType = 'ean_exact';
      } else if (sp.name && productName) {
        const nameSimilarity = similarity(sp.name.toLowerCase(), productName.toLowerCase());
        if (nameSimilarity >= 0.7) {
          score = Math.round(nameSimilarity * 100);
          matchType = 'name_fuzzy';

          if (sp.brand && productBrand && sp.brand.toLowerCase() === productBrand.toLowerCase()) {
            score = Math.min(100, score + 10);
            matchType = 'name_brand';
          }

          if (sp.product_model && productModel && sp.product_model.toLowerCase() === productModel.toLowerCase()) {
            score = Math.min(100, score + 10);
            matchType = 'name_model';
          }
        }
      } else if (sp.brand && productBrand && sp.product_model && productModel) {
        const brandMatch = sp.brand.toLowerCase() === productBrand.toLowerCase();
        const modelMatch = sp.product_model.toLowerCase() === productModel.toLowerCase();
        if (brandMatch && modelMatch) {
          score = 85;
          matchType = 'brand_model';
        }
      }

      if (score >= 70) {
        matches.push({
          supplier_product_id: sp.id,
          confidence_score: score,
          match_type: matchType,
          supplier_product: sp,
        });
      }
    }

    matches.sort((a, b) => b.confidence_score - a.confidence_score);

    let linksCreated = 0;
    if (auto_mode) {
      const highConfidenceMatches = matches.filter((m) => m.confidence_score >= 95);

      for (const match of highConfidenceMatches) {
        const { data: existing } = await supabase
          .from('product_links')
          .select('id')
          .eq('analysis_id', analysis_id)
          .eq('supplier_product_id', match.supplier_product_id)
          .maybeSingle();

        if (!existing) {
          const { error: insertError } = await supabase
            .from('product_links')
            .insert({
              analysis_id,
              supplier_product_id: match.supplier_product_id,
              link_type: 'auto',
              confidence_score: match.confidence_score,
              created_by: user.id,
            });

          if (!insertError) linksCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        matches: matches.slice(0, 10),
        links_created: linksCreated,
        total_matches: matches.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[auto-link-products] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
