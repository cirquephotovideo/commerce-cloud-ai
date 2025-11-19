import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoLinkRequest {
  supplierId: string;
  userId: string;
  productIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { supplierId, userId, productIds }: AutoLinkRequest = await req.json();

    console.log('[AUTO-LINK] Starting auto-link process:', {
      supplierId,
      userId,
      productCount: productIds.length,
    });

    let linked = 0;
    let unlinked = 0;
    const links: any[] = [];

    // Fetch all supplier products
    const { data: supplierProducts, error: spError } = await supabase
      .from('supplier_products')
      .select('id, ean, product_name, supplier_reference')
      .in('id', productIds)
      .eq('supplier_id', supplierId);

    if (spError) {
      throw new Error(`Failed to fetch supplier products: ${spError.message}`);
    }

    // Fetch all product analyses for this user
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('id, ean, analysis_result')
      .eq('user_id', userId);

    if (analysesError) {
      throw new Error(`Failed to fetch analyses: ${analysesError.message}`);
    }

    console.log('[AUTO-LINK] Loaded data:', {
      supplierProducts: supplierProducts?.length || 0,
      analyses: analyses?.length || 0,
    });

    // Process each supplier product
    for (const sp of supplierProducts || []) {
      let matchFound = false;
      let matchedAnalysisId: string | null = null;
      let confidenceScore = 0;
      let matchType = '';

      // Check if already linked
      const { data: existingLink } = await supabase
        .from('product_links')
        .select('id')
        .eq('supplier_product_id', sp.id)
        .maybeSingle();

      if (existingLink) {
        console.log('[AUTO-LINK] Product already linked:', sp.id);
        linked++;
        continue;
      }

      // 1. Try exact EAN match
      if (sp.ean) {
        const eanMatch = analyses?.find(a => a.ean === sp.ean);
        if (eanMatch) {
          matchedAnalysisId = eanMatch.id;
          confidenceScore = 1.0;
          matchType = 'ean';
          matchFound = true;
        }
      }

      // 2. Try name similarity match if no EAN match
      if (!matchFound && sp.product_name) {
        const normalizedSpName = sp.product_name.toLowerCase().trim();
        
        for (const analysis of analyses || []) {
          const analysisResult = analysis.analysis_result as any;
          const analysisName = analysisResult?.name?.toLowerCase().trim() || '';
          
          if (!analysisName) continue;

          // Calculate simple similarity score
          const similarity = calculateSimilarity(normalizedSpName, analysisName);
          
          if (similarity > 0.8 && similarity > confidenceScore) {
            matchedAnalysisId = analysis.id;
            confidenceScore = similarity;
            matchType = 'name_similarity';
            matchFound = true;
          }
        }
      }

      // 3. Create link if match found
      if (matchFound && matchedAnalysisId) {
        const { error: linkError } = await supabase
          .from('product_links')
          .insert({
            supplier_product_id: sp.id,
            analysis_id: matchedAnalysisId,
            link_type: 'automatic_import',
            confidence_score: confidenceScore,
            user_id: userId,
          });

        if (linkError) {
          console.error('[AUTO-LINK] Failed to create link:', linkError);
          unlinked++;
        } else {
          linked++;
          links.push({
            supplier_product_id: sp.id,
            analysis_id: matchedAnalysisId,
            confidence: confidenceScore,
            match_type: matchType,
          });
          console.log('[AUTO-LINK] Created link:', {
            product: sp.product_name,
            type: matchType,
            confidence: confidenceScore,
          });
        }
      } else {
        unlinked++;
        console.log('[AUTO-LINK] No match found for:', sp.product_name);
      }
    }

    console.log('[AUTO-LINK] Completed:', { linked, unlinked });

    return new Response(
      JSON.stringify({
        success: true,
        linked,
        unlinked,
        links,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[AUTO-LINK] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Simple string similarity calculator (Levenshtein-based)
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
