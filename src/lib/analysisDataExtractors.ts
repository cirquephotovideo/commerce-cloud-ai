// Utility functions to extract enriched data from product analysis

export interface RepairabilityData {
  score: number | null;
  ease: string;
  spareParts: string;
  durability: string;
}

export interface EnvironmentalData {
  ecoScore: number | null;
  co2Emissions: string;
  recyclability: string;
  certifications: string[];
}

export interface HSCodeData {
  code: string;
  description: string;
}

export const getRepairabilityData = (analysis: any): RepairabilityData | null => {
  try {
    const repairability = analysis?.analysis_result?.repairability || 
                         analysis?.repairability ||
                         analysis?.analysis_result?.technical?.repairability;
    
    console.log('Repairability data found:', repairability);
    
    if (!repairability) return null;

    return {
      score: typeof repairability.score === 'number' ? repairability.score : 
             typeof repairability.index === 'number' ? repairability.index : 
             typeof repairability.durability_score === 'number' ? repairability.durability_score : null,
      ease: repairability.ease || repairability.ease_of_repair || repairability.easOfRepair || 'Non spécifié',
      spareParts: repairability.spareParts || repairability.spare_parts_availability || repairability.sparePartsAvailability || 'Non spécifié',
      durability: repairability.durability || repairability.durability_score?.toString() || 'Non spécifié'
    };
  } catch (error) {
    console.error('Error extracting repairability data:', error);
    return null;
  }
};

export const getEnvironmentalData = (analysis: any): EnvironmentalData | null => {
  try {
    const environmental = analysis?.analysis_result?.environmental_impact || 
                         analysis?.environmental_impact ||
                         analysis?.analysis_result?.technical?.environmental_impact;
    
    console.log('Environmental data found:', environmental);
    
    if (!environmental) return null;

    return {
      ecoScore: typeof environmental.eco_score === 'number' ? environmental.eco_score :
                typeof environmental.ecoScore === 'number' ? environmental.ecoScore : null,
      co2Emissions: environmental.carbon_footprint || environmental.co2_emissions || environmental.carbonFootprint || 'Non disponible',
      recyclability: environmental.recyclability || environmental.recyclable || 'Non spécifié',
      certifications: Array.isArray(environmental.eco_certifications) ? environmental.eco_certifications : 
                     Array.isArray(environmental.certifications) ? environmental.certifications : []
    };
  } catch (error) {
    console.error('Error extracting environmental data:', error);
    return null;
  }
};

export const getHSCodeData = (analysis: any): HSCodeData | null => {
  try {
    const hsCode = analysis?.analysis_result?.hs_code || 
                   analysis?.hs_code ||
                   analysis?.analysis_result?.technical?.hs_code;
    
    console.log('HS Code data found:', hsCode);
    
    if (!hsCode) return null;

    return {
      code: hsCode.code || '',
      description: hsCode.description || hsCode.category || 'Non disponible'
    };
  } catch (error) {
    console.error('Error extracting HS code data:', error);
    return null;
  }
};

export const getProductImages = (analysis: any): string[] => {
  try {
    // Priority 1: Images stored in the table (real product images)
    const storedImages = analysis?.image_urls;
    if (Array.isArray(storedImages) && storedImages.length > 0) {
      return storedImages;
    }
    
    // Priority 2: Images in analysis_result
    const images = analysis?.analysis_result?.images || 
                   analysis?.analysis_result?.image_urls ||
                   [];
    
    return Array.isArray(images) ? images : [];
  } catch (error) {
    console.error('Error extracting product images:', error);
    return [];
  }
};

export const getProductName = (analysis: any): string => {
  try {
    return analysis?.analysis_result?.product_name ||
           analysis?.analysis_result?.name ||
           analysis?.analysis_result?.title ||
           analysis?.analysis_result?.productName ||
           'Produit sans nom';
  } catch (error) {
    return 'Produit sans nom';
  }
};

export const getProductPrice = (analysis: any): string => {
  try {
    const price = analysis?.analysis_result?.price ||
                  analysis?.analysis_result?.pricing?.recommended_price;
    return price || 'N/A';
  } catch (error) {
    return 'N/A';
  }
};

export const getProductScore = (analysis: any): number | null => {
  try {
    const score = analysis?.analysis_result?.quality_score ||
                  analysis?.analysis_result?.score;
    return typeof score === 'number' ? score : null;
  } catch (error) {
    return null;
  }
};

export const getProductCategory = (analysis: any): string => {
  try {
    return analysis?.analysis_result?.category ||
           analysis?.mapped_category_name ||
           'Non catégorisé';
  } catch (error) {
    return 'Non catégorisé';
  }
};

export interface ExtractedAnalysisData {
  productName: string;
  productPrice: string;
  productImages: string[];
  estimatedPrice: string | null;
  productMargin: string | null;
  productScore: number | null;
  productCategory: string;
}

export const extractAnalysisData = (analysis: any): ExtractedAnalysisData => {
  const productPrice = getProductPrice(analysis);
  const estimatedPrice = analysis?.analysis_result?.pricing?.recommended_price || null;
  
  let productMargin: string | null = null;
  if (productPrice !== 'N/A' && estimatedPrice) {
    const price = parseFloat(productPrice);
    const estimated = parseFloat(estimatedPrice);
    if (!isNaN(price) && !isNaN(estimated) && price > 0) {
      productMargin = (((estimated - price) / price) * 100).toFixed(1);
    }
  }

  return {
    productName: getProductName(analysis),
    productPrice,
    productImages: getProductImages(analysis),
    estimatedPrice,
    productMargin,
    productScore: getProductScore(analysis),
    productCategory: getProductCategory(analysis),
  };
};
