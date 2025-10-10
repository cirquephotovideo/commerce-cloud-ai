/**
 * Utility functions for formatting data in the ImportedProducts page
 */

export const formatPrice = (price: number | string | undefined, currency = '€'): string => {
  if (price === undefined || price === null) return 'N/A';
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'N/A';
  return `${numPrice.toFixed(2)} ${currency}`;
};

export const formatMargin = (margin: number | undefined): string => {
  if (margin === undefined || margin === null) return 'N/A';
  return `${margin.toFixed(1)}%`;
};

export const getMarginColor = (margin: number | undefined): 'default' | 'secondary' | 'destructive' => {
  if (margin === undefined || margin === null) return 'secondary';
  if (margin > 30) return 'default'; // Green
  if (margin >= 15) return 'secondary'; // Yellow
  return 'destructive'; // Red
};

export const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'completed': return 'default';
    case 'pending': return 'secondary';
    case 'enriching': return 'outline';
    case 'failed': return 'destructive';
    default: return 'secondary';
  }
};

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'N/A';
  }
};

export const formatRanking = (ranking: any): string => {
  if (!ranking) return 'N/A';
  if (typeof ranking === 'object' && ranking.percentage) {
    return `Top ${ranking.percentage}%`;
  }
  return String(ranking);
};

export const getImageUrl = (product: any): string => {
  const analyses = product.product_analyses;
  const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
  const imageUrls = analysis?.image_urls;
  
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    return imageUrls[0];
  }
  
  return '/placeholder.svg';
};

export const extractAnalysisData = (product: any) => {
  const analyses = product.product_analyses;
  const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
  
  return {
    analysis,
    margin: analysis?.margin_percentage,
    estimatedPrice: analysis?.analysis_result?.price_estimation?.estimated_price,
    category: analysis?.analysis_result?.category,
    ranking: analysis?.analysis_result?.amazon_ranking,
    imageUrls: analysis?.image_urls || [],
    imageCount: analysis?.image_urls?.length || 0,
    analysisId: analysis?.id,
  };
};

export const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
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
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - distance / maxLength;
};

/**
 * Format specifications object into key-value pairs
 */
export const formatSpecifications = (specs: any): Array<{key: string, value: string}> => {
  if (!specs || typeof specs !== 'object') return [];
  
  const formatted: Array<{key: string, value: string}> = [];
  
  Object.entries(specs).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      // Format key to be more readable
      const formattedKey = key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Format value
      let formattedValue = String(value);
      if (typeof value === 'object') {
        formattedValue = JSON.stringify(value);
      }
      
      formatted.push({ key: formattedKey, value: formattedValue });
    }
  });
  
  return formatted;
};

/**
 * Format features array for display
 */
export const formatFeaturesList = (features: any[]): string[] => {
  if (!Array.isArray(features)) return [];
  
  return features
    .filter(f => f && typeof f === 'string' && f.trim().length > 0)
    .map(f => f.trim());
};

/**
 * Extract and format product info for table display
 */
export const formatProductInfo = (product: any, analysis?: any) => {
  const analysisData = analysis || extractAnalysisData(product);
  
  return {
    productName: product.product_name,
    ean: product.ean,
    purchasePrice: product.purchase_price,
    sellingPrice: analysisData.estimatedPrice,
    margin: analysisData.margin,
    supplier: product.supplier_configurations?.supplier_name,
    category: analysisData.category,
    ranking: analysisData.ranking,
    imageCount: analysisData.imageCount,
    status: product.enrichment_status,
    brand: analysisData.analysis?.analysis_result?.brand,
    stock: product.stock_quantity,
  };
};
