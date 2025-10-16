/**
 * FVS-specific mapping and normalization utilities
 * Handles French supplier data formats, prices, stock, EAN validation
 */

// Common FVS column headers (French)
const FVS_HEADER_MAP: Record<string, string[]> = {
  ean: ['code ean', 'ean', 'ean13', 'gtin'],
  supplier_reference: ['code produit', 'référence', 'ref', 'code', 'ref fournisseur'],
  product_name: ['description', 'désignation', 'libellé', 'nom', 'article'],
  brand: ['marque', 'brand', 'fabricant'],
  category: ['catégorie', 'category', 'gamme', 'famille'],
  purchase_price: ['pau ht', 'prix d\'achat', 'pa ht', 'prix achat ht', 'tarif ht'],
  purchase_price_fallback: ['ppi ht', 'prix public indicatif ht', 'ancien pau ht'],
  stock_quantity: ['qte', 'quantité', 'stock'],
  stock_status: ['disponibilité', 'dispo', 'statut'],
  vat_rate: ['tva', 'taux tva', 'tax']
};

/**
 * Normalize header string for comparison
 */
export function normalizeFVSHeader(header: any): string {
  if (!header) return '';
  return String(header)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Auto-detect FVS column mapping from headers
 */
export function detectFVSMapping(headers: string[]): Record<string, number | null> {
  const normalizedHeaders = headers.map(normalizeFVSHeader);
  const mapping: Record<string, number | null> = {
    ean: null,
    supplier_reference: null,
    product_name: null,
    brand: null,
    category: null,
    purchase_price: null,
    stock_quantity: null,
    vat_rate: null,
  };

  // Find each field
  for (const [field, patterns] of Object.entries(FVS_HEADER_MAP)) {
    // Skip fallback fields in first pass
    if (field.includes('_fallback')) continue;

    const matchIndex = normalizedHeaders.findIndex(h => 
      patterns.some(p => h.includes(p) || p.includes(h))
    );

    if (matchIndex !== -1) {
      if (field === 'purchase_price' || field === 'stock_quantity') {
        mapping[field] = matchIndex;
      } else if (field.startsWith('purchase_price_fallback') || field.startsWith('stock_status')) {
        // Store for fallback logic later
        continue;
      } else {
        mapping[field] = matchIndex;
      }
    }
  }

  console.log('[FVS-MAPPING] Auto-detected mapping:', mapping);
  return mapping;
}

/**
 * Normalize French price string to number
 * Handles: "1 234,56", "1234.56", "NC", "—", etc.
 */
export function normalizeFVSPrice(value: any): number | null {
  if (!value) return null;
  
  const str = String(value).trim().toUpperCase();
  
  // Handle "NC" (Non Communiqué) or other non-numeric values
  if (str === 'NC' || str === '—' || str === '-' || str === 'N/A') {
    return null;
  }

  // Remove spaces, replace comma with dot
  const cleaned = str
    .replace(/\s/g, '')
    .replace(',', '.');

  const num = parseFloat(cleaned);
  
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Normalize stock quantity from French formats
 * Handles: numbers, "Non disponible", "Disponible", etc.
 */
export function normalizeFVSStock(qtyValue: any, statusValue?: any): number | null {
  // Try quantity field first
  if (qtyValue !== null && qtyValue !== undefined && qtyValue !== '') {
    const qtyStr = String(qtyValue).trim().toLowerCase();
    
    // Handle text values
    if (qtyStr === 'non disponible' || qtyStr === 'indisponible' || qtyStr === 'nc') {
      return 0;
    }
    
    if (qtyStr === 'disponible' || qtyStr === 'en stock') {
      return 1; // At least 1
    }

    // Parse number
    const num = parseInt(qtyStr.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= 0) {
      return num;
    }
  }

  // Fallback to status field
  if (statusValue) {
    const statusStr = String(statusValue).trim().toLowerCase();
    if (statusStr.includes('disponible') && !statusStr.includes('non')) {
      return 1;
    }
    if (statusStr.includes('non disponible') || statusStr.includes('indisponible')) {
      return 0;
    }
  }

  return null;
}

/**
 * Validate EAN13 checksum
 */
export function isValidEAN13(ean: string): boolean {
  if (!ean || !/^\d{13}$/.test(ean)) return false;

  const digits = ean.split('').map(Number);
  const checksum = digits[12];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  const calculatedChecksum = (10 - (sum % 10)) % 10;
  return checksum === calculatedChecksum;
}

/**
 * Normalize EAN: clean, validate, return null if invalid
 */
export function normalizeFVSEAN(value: any): string | null {
  if (!value) return null;
  
  const str = String(value).trim().replace(/\s/g, '');
  
  // Must be 13 digits
  if (!/^\d{13}$/.test(str)) return null;
  
  // Validate checksum
  if (!isValidEAN13(str)) {
    console.warn(`[FVS-MAPPING] Invalid EAN13 checksum: ${str}`);
    return null; // Don't block, just return null
  }
  
  return str;
}

/**
 * Normalize product name: trim, remove HTML entities, etc.
 */
export function normalizeFVSProductName(value: any): string | null {
  if (!value) return null;
  
  return String(value)
    .trim()
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .substring(0, 500) || null;
}

/**
 * Extract normalized product data from a raw row using mapping
 */
export function extractFVSProduct(
  row: any[],
  mapping: Record<string, number | null>,
  headers: string[]
): {
  ean: string | null;
  supplier_reference: string | null;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  purchase_price: number | null;
  stock_quantity: number | null;
  vat_rate: number | null;
  raw_data: any;
} | null {
  // Extract raw values
  const ean = mapping.ean !== null ? row[mapping.ean] : null;
  const supplierRef = mapping.supplier_reference !== null ? row[mapping.supplier_reference] : null;
  const productName = mapping.product_name !== null ? row[mapping.product_name] : null;
  const brand = mapping.brand !== null ? row[mapping.brand] : null;
  const category = mapping.category !== null ? row[mapping.category] : null;
  
  // Price with fallback logic
  let purchasePrice = null;
  if (mapping.purchase_price !== null) {
    purchasePrice = normalizeFVSPrice(row[mapping.purchase_price]);
  }
  // If PAU HT is "NC", try PPI HT
  if (purchasePrice === null) {
    const fallbackIndex = headers.findIndex(h => 
      normalizeFVSHeader(h).includes('ppi ht') || 
      normalizeFVSHeader(h).includes('ancien pau')
    );
    if (fallbackIndex !== -1) {
      purchasePrice = normalizeFVSPrice(row[fallbackIndex]);
    }
  }

  // Stock with fallback to status
  const stockStatusIndex = headers.findIndex(h => 
    normalizeFVSHeader(h).includes('disponibilite') ||
    normalizeFVSHeader(h).includes('dispo')
  );
  const stockQuantity = normalizeFVSStock(
    mapping.stock_quantity !== null ? row[mapping.stock_quantity] : null,
    stockStatusIndex !== -1 ? row[stockStatusIndex] : null
  );

  const vatRate = mapping.vat_rate !== null ? normalizeFVSPrice(row[mapping.vat_rate]) : null;

  // Normalize
  const normalizedEAN = normalizeFVSEAN(ean);
  const normalizedRef = supplierRef ? String(supplierRef).trim() : null;
  const normalizedName = normalizeFVSProductName(productName);
  const normalizedBrand = brand ? String(brand).trim().substring(0, 100) : null;
  const normalizedCategory = category ? String(category).trim().substring(0, 100) : null;

  // Must have at least supplier_reference or product_name
  if (!normalizedRef && !normalizedName) {
    return null;
  }

  return {
    ean: normalizedEAN,
    supplier_reference: normalizedRef,
    product_name: normalizedName,
    brand: normalizedBrand,
    category: normalizedCategory,
    purchase_price: purchasePrice,
    stock_quantity: stockQuantity,
    vat_rate: vatRate,
    raw_data: row
  };
}
