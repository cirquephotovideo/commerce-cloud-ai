/**
 * Validation system for product analysis data
 * Ensures completeness and quality of enrichment data
 */

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  incompleteFields: string[];
  confidence: 'high' | 'medium' | 'low';
  completeness_score: number;
  quality_issues: string[];
}

export interface FieldRequirement {
  path: string;
  required: boolean;
  minLength?: number;
  minItems?: number;
  validator?: (value: any) => boolean;
}

/**
 * Define required fields and their validation rules
 */
const REQUIRED_FIELDS: FieldRequirement[] = [
  // Basic product info
  { path: 'product_name', required: true, minLength: 3 },
  { path: 'brand', required: false },
  { path: 'description', required: true, minLength: 30 },
  { path: 'description_long', required: true, minLength: 300 },
  
  // SEO
  { path: 'seo.title', required: true, minLength: 30 },
  { path: 'seo.meta_description', required: true, minLength: 100 },
  { path: 'seo.keywords', required: true, minItems: 3 },
  { path: 'seo.score', required: true, validator: (v) => v >= 50 },
  
  // Pricing
  { path: 'pricing.estimated_price', required: true },
  { path: 'pricing.market_position', required: true },
  { path: 'pricing.competitive_analysis', required: true, minLength: 50 },
  { path: 'pricing.recommended_margin', required: false },
  
  // Competition
  { path: 'competition.main_competitors', required: true, minItems: 1 },
  { path: 'competition.differentiation', required: true, minLength: 50 },
  { path: 'competitive_pros', required: true, minItems: 2 },
  { path: 'competitive_cons', required: true, minItems: 1 },
  
  // Market analysis
  { path: 'use_cases', required: true, minItems: 2 },
  { path: 'market_position', required: true },
  { path: 'trends.market_trend', required: true },
  { path: 'trends.popularity_score', required: true },
  
  // Technical specs
  { path: 'repairability.score', required: true },
  { path: 'repairability.ease_of_repair', required: true },
  { path: 'hs_code.code', required: true, minLength: 6 },
  
  // Environmental
  { path: 'environmental_impact.recyclability_score', required: true },
  { path: 'environmental_impact.eco_score', required: true },
  
  // Image optimization
  { path: 'image_optimization.suggested_angles', required: true, minItems: 3 },
  { path: 'image_optimization.quality_score', required: true },
  
  // Categories and tags
  { path: 'tags_categories.primary_category', required: true },
  { path: 'tags_categories.suggested_tags', required: true, minItems: 3 },
  
  // Customer reviews
  { path: 'customer_reviews.sentiment_score', required: true },
  { path: 'customer_reviews.common_praises', required: true, minItems: 1 },
  
  // Global report
  { path: 'global_report.overall_score', required: true, validator: (v) => v >= 50 },
  { path: 'global_report.strengths', required: true, minItems: 2 },
  { path: 'global_report.priority_actions', required: true, minItems: 1 },
  
  // Research metadata
  { path: 'web_sources', required: true, minItems: 3 }
];

/**
 * Main validation function for product analysis
 */
export function validateAnalysis(data: any): ValidationResult {
  const missingFields: string[] = [];
  const incompleteFields: string[] = [];
  const qualityIssues: string[] = [];
  
  // Check each required field
  for (const fieldReq of REQUIRED_FIELDS) {
    const value = getNestedProperty(data, fieldReq.path);
    
    // Check if field is missing
    if (value === undefined || value === null || value === '') {
      if (fieldReq.required) {
        missingFields.push(fieldReq.path);
      }
      continue;
    }
    
    // Check if field contains "N/A" (acceptable but note it)
    if (typeof value === 'string' && (value === 'N/A' || value.includes('N/A'))) {
      if (!data._research_notes || !data._research_notes.includes(fieldReq.path)) {
        qualityIssues.push(`${fieldReq.path} is N/A without explanation`);
      }
      continue;
    }
    
    // Check minimum length for strings
    if (fieldReq.minLength && typeof value === 'string') {
      if (value.length < fieldReq.minLength) {
        incompleteFields.push(`${fieldReq.path} (too short: ${value.length} < ${fieldReq.minLength})`);
      }
    }
    
    // Check minimum items for arrays
    if (fieldReq.minItems && Array.isArray(value)) {
      if (value.length < fieldReq.minItems) {
        incompleteFields.push(`${fieldReq.path} (too few items: ${value.length} < ${fieldReq.minItems})`);
      }
    }
    
    // Check custom validator
    if (fieldReq.validator && !fieldReq.validator(value)) {
      incompleteFields.push(`${fieldReq.path} (failed validation)`);
    }
    
    // Check if field is incomplete based on type
    if (isFieldIncomplete(value, fieldReq.path)) {
      incompleteFields.push(fieldReq.path);
    }
  }
  
  // Calculate completeness score
  const totalRequiredFields = REQUIRED_FIELDS.filter(f => f.required).length;
  const missingRequiredFields = missingFields.filter(field => 
    REQUIRED_FIELDS.find(f => f.path === field && f.required)
  ).length;
  const incompleteWeight = 0.5; // Incomplete fields count as half-missing
  
  const completeness_score = Math.round(
    ((totalRequiredFields - missingRequiredFields - (incompleteFields.length * incompleteWeight)) / 
     totalRequiredFields) * 100
  );
  
  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (completeness_score >= 85 && qualityIssues.length === 0) {
    confidence = 'high';
  } else if (completeness_score >= 65) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  // Check confidence metadata if provided
  if (data._confidence_level?.overall) {
    if (data._confidence_level.overall === 'low') {
      confidence = 'low';
      qualityIssues.push('Self-reported low confidence');
    }
  }
  
  return {
    isValid: missingFields.length === 0 && incompleteFields.length === 0,
    missingFields,
    incompleteFields,
    confidence,
    completeness_score,
    quality_issues: qualityIssues
  };
}

/**
 * Check if a field value is incomplete
 */
function isFieldIncomplete(value: any, fieldPath: string): boolean {
  // Empty arrays
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  
  // Empty objects
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (Object.keys(value).length === 0) {
      return true;
    }
    // Check if all values are empty/null
    const allEmpty = Object.values(value).every(v => 
      v === null || v === undefined || v === '' || 
      (typeof v === 'string' && v.trim() === '')
    );
    if (allEmpty) return true;
  }
  
  // Very short strings (generic placeholders)
  if (typeof value === 'string') {
    const lowercaseValue = value.toLowerCase();
    if (
      lowercaseValue === 'tbd' ||
      lowercaseValue === 'todo' ||
      lowercaseValue === 'à définir' ||
      lowercaseValue === 'unknown' ||
      lowercaseValue === 'inconnu'
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get nested property from object using dot notation
 */
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => {
    return current?.[prop];
  }, obj);
}

/**
 * Generate targeted prompts for missing fields
 */
export function generateFieldSpecificPrompt(
  field: string,
  productData: any,
  existingData: any
): string {
  const prompts: Record<string, string> = {
    'seo.title': `Génère un titre SEO optimisé de 60-70 caractères pour "${productData.product_name || productData.name}". Inclus le mot-clé principal au début. Format JSON: {"title": "..."}`,
    
    'seo.meta_description': `Crée une meta description persuasive de 150-160 caractères pour "${productData.product_name || productData.name}" avec un appel à l'action. Format JSON: {"meta_description": "..."}`,
    
    'description_long': `Rédige une description marketing de 600-1000 mots pour "${productData.product_name || productData.name}" structurée en 4 paragraphes: 1) Hook accrocheur, 2) Caractéristiques techniques, 3) Bénéfices utilisateur, 4) Différenciation vs concurrence. Format JSON: {"description_long": "..."}`,
    
    'pricing.competitive_analysis': `Analyse le positionnement prix de "${productData.product_name || productData.name}" par rapport à ses concurrents. Recherche les prix sur 5-10 e-commerçants et fournis une analyse détaillée. Format JSON: {"competitive_analysis": "...", "competitor_prices": [...]}`,
    
    'competition.main_competitors': `Identifie 3-5 concurrents directs de "${productData.product_name || productData.name}" avec leurs modèles, prix et différences clés. Recherche web obligatoire. Format JSON: {"main_competitors": [{"name": "...", "product": "...", "price": "...", "main_difference": "..."}]}`,
    
    'technical_specifications': `Recherche les spécifications techniques complètes de "${productData.product_name || productData.name}": dimensions, poids, matériaux, certifications, etc. Consulte le site officiel et fiches techniques. Format JSON détaillé avec unités.`,
    
    'hs_code.code': `Trouve le code HS (Harmonized System) à 8 chiffres pour "${productData.product_name || productData.name}" de catégorie "${productData.category}". Vérifie la nomenclature douanière internationale. Format JSON: {"code": "12345678", "description": "..."}`,
    
    'customer_reviews': `Recherche et analyse les avis clients pour "${productData.product_name || productData.name}" sur Amazon, forums, sites spécialisés. Extrais sentiment score, points positifs récurrents et plaintes courantes. Format JSON: {"sentiment_score": 4.2, "common_praises": [...], "common_complaints": [...]}`,
    
    'image_optimization': `Fournis des recommandations complètes pour optimiser les images de "${productData.product_name || productData.name}": angles suggérés, éclairage, composition, specs techniques, prompts pour génération AI. Format JSON détaillé.`,
    
    'web_sources': `Liste toutes les URLs consultées pour analyser "${productData.product_name || productData.name}" avec le type d'information trouvée sur chacune. Minimum 5 sources fiables. Format JSON: ["https://... - Type info"]`
  };
  
  // Return specific prompt or generate generic one
  return prompts[field] || `Enrichis le champ "${field}" pour le produit "${productData.product_name || productData.name}". Données existantes: ${JSON.stringify(existingData)}. Retourne UNIQUEMENT du JSON valide.`;
}

/**
 * Validate specific enrichment data (specifications, cost analysis, etc.)
 */
export function validateEnrichment(
  enrichmentType: string,
  data: any
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  switch (enrichmentType) {
    case 'specifications':
      if (!data.dimensions) issues.push('Missing dimensions');
      if (!data.materials || data.materials.length === 0) issues.push('Missing materials');
      if (!data.certifications) issues.push('Missing certifications');
      if (!data.warranty) issues.push('Missing warranty info');
      break;
      
    case 'cost_analysis':
      if (!data.market_research) issues.push('Missing market research');
      if (!data.pricing_strategy?.recommended_price) issues.push('Missing recommended price');
      if (!data.margin_analysis) issues.push('Missing margin analysis');
      if (!data.competitor_prices || data.competitor_prices.length < 5) {
        issues.push('Insufficient competitor price data (need at least 5)');
      }
      break;
      
    case 'seo':
      if (!data.title || data.title.length < 30) issues.push('SEO title too short');
      if (!data.meta_description || data.meta_description.length < 100) {
        issues.push('Meta description too short');
      }
      if (!data.keywords || data.keywords.length < 5) {
        issues.push('Insufficient keywords (need at least 5)');
      }
      break;
      
    case 'long_description':
      if (!data.description_long) issues.push('Missing long description');
      if (data.description_long && data.description_long.split(' ').length < 400) {
        issues.push('Long description too short (need 400+ words)');
      }
      break;
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
