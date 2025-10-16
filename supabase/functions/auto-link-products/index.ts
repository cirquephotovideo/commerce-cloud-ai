import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Phase C.3: Auto-linking intelligent produits ↔ fournisseurs
 * Méthodes: EAN exact, nom fuzzy, brand+model, AI matching
 */

// Calcul similarité Levenshtein simplifiée
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i++) track[0][i] = i;
  for (let j = 0; j <= s2.length; j++) track[j][0] = j;
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  
  return track[s2.length][s1.length];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_ean, analysis_id, auto_mode = true } = await req.json();
    
    if (!product_ean && !analysis_id) {
      return new Response(
        JSON.stringify({ error: 'product_ean or analysis_id required', code: 'MISSING_PARAMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', code: 'AUTH_ERROR' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', code: 'TOKEN_EXPIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTO-LINK] Request:', { product_ean, analysis_id, auto_mode, user_id: user.id });

    // Récupérer le produit principal
    let mainProduct: any = null;
    
    if (analysis_id) {
      const { data, error } = await supabase
        .from('product_analyses')
        .select('*')
        .eq('id', analysis_id)
        .eq('user_id', user.id)
        .single();
      
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Product analysis not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      mainProduct = data;
    }

    const targetEAN = product_ean || mainProduct?.ean || mainProduct?.analysis_result?.barcode;
    const productName = mainProduct?.product_name || mainProduct?.analysis_result?.product_name;
    const brand = mainProduct?.analysis_result?.brand;

    if (!targetEAN && !productName) {
      return new Response(
        JSON.stringify({ error: 'No EAN or product name to match', code: 'MISSING_DATA' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AUTO-LINK] Matching criteria:', { targetEAN, productName, brand });

    // Chercher les correspondances
    const matches: Array<{ supplier_product: any; score: number; method: string }> = [];

    // Méthode 1: EAN exact (score 100)
    if (targetEAN) {
      const { data: eanMatches } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('ean', targetEAN);

      if (eanMatches) {
        for (const sp of eanMatches) {
          matches.push({ supplier_product: sp, score: 100, method: 'ean' });
        }
        console.log(`[AUTO-LINK] Found ${eanMatches.length} EAN exact matches`);
      }
    }

    // Méthode 2: Nom fuzzy (score 60-95)
    if (productName) {
      const { data: allSupplierProducts } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('user_id', user.id)
        .limit(500); // Limit pour performance

      if (allSupplierProducts) {
        for (const sp of allSupplierProducts) {
          const nameSim = similarity(productName, sp.name || '');
          
          if (nameSim > 0.7) { // Seuil 70%
            const score = Math.round(nameSim * 95); // Max 95 pour fuzzy
            matches.push({ supplier_product: sp, score, method: 'name_fuzzy' });
          }
        }
        console.log(`[AUTO-LINK] Found ${matches.filter(m => m.method === 'name_fuzzy').length} fuzzy name matches`);
      }
    }

    // Méthode 3: Brand + Model (score 80-90)
    if (brand && productName) {
      const model = productName.replace(brand, '').trim().split(' ')[0]; // Premier mot après marque
      
      const { data: brandMatches } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('brand', brand)
        .ilike('name', `%${model}%`);

      if (brandMatches) {
        for (const sp of brandMatches) {
          // Éviter doublons
          if (!matches.some(m => m.supplier_product.id === sp.id)) {
            matches.push({ supplier_product: sp, score: 85, method: 'brand_model' });
          }
        }
        console.log(`[AUTO-LINK] Found ${brandMatches.length} brand+model matches`);
      }
    }

    // Trier par score décroissant
    matches.sort((a, b) => b.score - a.score);

    // En mode auto, créer le lien automatiquement si score > 95
    const linksCreated: any[] = [];
    
    if (auto_mode) {
      for (const match of matches) {
        if (match.score >= 95) {
          const { data: link, error: linkError } = await supabase
            .from('product_links')
            .insert({
              user_id: user.id,
              product_ean: targetEAN,
              supplier_product_id: match.supplier_product.id,
              link_type: 'auto',
              confidence_score: match.score,
              matching_method: match.method,
              match_details: {
                name_similarity: match.method === 'name_fuzzy' ? similarity(productName || '', match.supplier_product.name || '') : null,
                matched_at: new Date().toISOString()
              }
            })
            .select()
            .single();

          if (!linkError && link) {
            linksCreated.push(link);
            console.log(`[AUTO-LINK] Auto-linked with score ${match.score} via ${match.method}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        matches: matches.slice(0, 10), // Top 10
        links_created: linksCreated.length,
        auto_linked: auto_mode,
        stats: {
          total_matches: matches.length,
          high_confidence: matches.filter(m => m.score >= 95).length,
          medium_confidence: matches.filter(m => m.score >= 70 && m.score < 95).length,
          low_confidence: matches.filter(m => m.score < 70).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTO-LINK] Error:', error);
    
    const errorCode = 
      error.message?.includes('auth') || error.message?.includes('token') ? 'AUTH_ERROR' :
      error.message?.includes('not found') ? 'NOT_FOUND' :
      'INTERNAL_ERROR';

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        code: errorCode
      }),
      { 
        status: errorCode === 'AUTH_ERROR' ? 401 : errorCode === 'NOT_FOUND' ? 404 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});