import { supabase } from "@/integrations/supabase/client";
import { calculateSimilarity } from "./formatters";

export interface MatchSuggestion {
  supplier_product_id: string;
  analysis_id: string;
  confidence: number;
  match_type: 'ean' | 'name' | 'brand';
  supplierProduct?: any;
  analysis?: any;
}

export async function autoLinkProducts(userId: string): Promise<MatchSuggestion[]> {
  // Fetch supplier products without links
  const { data: supplierProducts, error: spError } = await supabase
    .from('supplier_products')
    .select(`
      *,
      supplier_configurations(supplier_name),
      product_links!left(id)
    `)
    .eq('user_id', userId)
    .is('product_links.id', null);
  
  if (spError) throw spError;
  
  // Fetch all product analyses
  const { data: analyses, error: analysesError } = await supabase
    .from('product_analyses')
    .select('id, ean, analysis_result')
    .eq('user_id', userId);
  
  if (analysesError) throw analysesError;
  
  const suggestions: MatchSuggestion[] = [];
  
  for (const sp of supplierProducts || []) {
    // Match by EAN (100% confidence)
    if (sp.ean) {
      const exactMatch = analyses?.find(a => a.ean === sp.ean);
      if (exactMatch) {
        suggestions.push({
          supplier_product_id: sp.id,
          analysis_id: exactMatch.id,
          confidence: 1.0,
          match_type: 'ean',
          supplierProduct: sp,
          analysis: exactMatch,
        });
        continue;
      }
    }
    
    // Match by brand + name (extract from additional_data if exists)
    const spBrand = (sp.additional_data as any)?.brand;
    if (spBrand && sp.product_name) {
      const brandMatches = analyses?.filter(a => {
        const analysisResult = a.analysis_result as any;
        const analysisBrand = analysisResult?.brand || '';
        return analysisBrand.toLowerCase() === spBrand.toLowerCase();
      });
      
      if (brandMatches && brandMatches.length > 0) {
        const nameMatches = brandMatches
          .map(a => {
            const analysisResult = a.analysis_result as any;
            return {
              analysis: a,
              score: calculateSimilarity(
                sp.product_name,
                analysisResult?.name || ''
              ),
            };
          })
          .filter(m => m.score > 0.7)
          .sort((a, b) => b.score - a.score);
        
        if (nameMatches[0]) {
          suggestions.push({
            supplier_product_id: sp.id,
            analysis_id: nameMatches[0].analysis.id,
            confidence: nameMatches[0].score,
            match_type: 'brand',
            supplierProduct: sp,
            analysis: nameMatches[0].analysis,
          });
          continue;
        }
      }
    }
    
    // Match by name similarity only
    const nameMatches = analyses
      ?.map(a => {
        const analysisResult = a.analysis_result as any;
        return {
          analysis: a,
          score: calculateSimilarity(
            sp.product_name || '',
            analysisResult?.name || ''
          ),
        };
      })
      .filter(m => m.score > 0.75)
      .sort((a, b) => b.score - a.score);
    
    if (nameMatches && nameMatches[0]) {
      suggestions.push({
        supplier_product_id: sp.id,
        analysis_id: nameMatches[0].analysis.id,
        confidence: nameMatches[0].score,
        match_type: 'name',
        supplierProduct: sp,
        analysis: nameMatches[0].analysis,
      });
    }
  }
  
  return suggestions;
}

export async function createProductLink(
  supplierProductId: string,
  analysisId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");
  
  const { error } = await supabase
    .from('product_links')
    .insert({
      supplier_product_id: supplierProductId,
      analysis_id: analysisId,
      link_type: 'automatic',
      user_id: user.id,
    });
  
  if (error) throw error;
}

export async function deleteProductLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('product_links')
    .delete()
    .eq('id', linkId);
  
  if (error) throw error;
}
