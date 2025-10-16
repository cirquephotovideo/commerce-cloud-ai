/**
 * Intelligent header row detection utility for supplier files
 * Scans first 20 rows to find the most likely header row
 */

const HEADER_KEYWORDS = [
  'prix', 'tarif', 'référence', 'ref', 'code', 'ean', 'produit', 'article',
  'désignation', 'description', 'stock', 'quantité', 'qte', 'marque',
  'catégorie', 'category', 'brand', 'price', 'product', 'name', 'pau',
  'ppi', 'disponibilité', 'statut', 'tva'
];

/**
 * Normalize header string for consistent comparison
 */
export function normalizeHeader(h: any): string {
  if (h === null || h === undefined) return '';
  const str = String(h).toLowerCase().trim();
  // Collapse multiple spaces into one
  return str.replace(/\s+/g, ' ');
}

/**
 * Detect the header row in a dataset
 * @param rows - Array of rows from Excel/CSV file
 * @returns Index of the header row (0-based)
 */
export function detectHeaderRow(rows: any[][]): number {
  if (!rows || rows.length === 0) return 0;

  // Scan first 20 rows
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;

    // Count non-empty columns
    const nonEmptyCols = row.filter((cell: any) => {
      const str = String(cell || '').trim();
      return str.length > 0;
    }).length;

    // Need at least 5 non-empty columns to be a header
    if (nonEmptyCols < 5) continue;

    // Count keyword matches in row
    let matchCount = 0;
    for (const cell of row) {
      const normalized = normalizeHeader(cell);
      const hasKeyword = HEADER_KEYWORDS.some(keyword => normalized.includes(keyword));
      if (hasKeyword) matchCount++;
    }

    // Need at least 3 keyword matches
    if (matchCount >= 3) {
      // Verify next row is not empty (data should follow headers)
      if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const hasData = nextRow && nextRow.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
        if (hasData) {
          console.log(`[detectHeaderRow] Header detected at row ${i + 1} with ${matchCount} keywords and ${nonEmptyCols} columns`);
          return i;
        }
      }
    }
  }

  // Fallback to first row
  console.log('[detectHeaderRow] No clear header detected, using row 0');
  return 0;
}

/**
 * Suggest column mapping based on normalized header names
 */
export function suggestMapping(headers: string[]): Record<string, number | null> {
  const mapping: Record<string, number | null> = {
    product_name: null,
    purchase_price: null,
    ean: null,
    supplier_reference: null,
    stock: null,
    brand: null,
    category: null,
    vat_rate: null
  };

  const normalizedHeaders = headers.map(normalizeHeader);

  // Product name patterns
  const productPatterns = ['description', 'désignation', 'produit', 'article', 'libellé', 'nom'];
  mapping.product_name = normalizedHeaders.findIndex(h => 
    productPatterns.some(p => h.includes(p))
  );
  if (mapping.product_name === -1) mapping.product_name = null;

  // Purchase price patterns
  const pricePatterns = ['pau ht', 'prix d\'achat', 'pa ht', 'prix achat', 'tarif', 'pau', 'prix ht'];
  mapping.purchase_price = normalizedHeaders.findIndex(h => 
    pricePatterns.some(p => h.includes(p))
  );
  if (mapping.purchase_price === -1) mapping.purchase_price = null;

  // EAN patterns
  const eanPatterns = ['ean', 'ean13', 'code ean', 'gtin'];
  mapping.ean = normalizedHeaders.findIndex(h => 
    eanPatterns.some(p => h === p || h.includes(p))
  );
  if (mapping.ean === -1) mapping.ean = null;

  // Stock patterns
  const stockPatterns = ['qte', 'quantité', 'stock', 'disponibilité', 'dispo'];
  mapping.stock = normalizedHeaders.findIndex(h => 
    stockPatterns.some(p => h.includes(p))
  );
  if (mapping.stock === -1) mapping.stock = null;

  // Supplier reference patterns
  const refPatterns = ['code produit', 'référence', 'ref', 'code', 'ref fournisseur'];
  mapping.supplier_reference = normalizedHeaders.findIndex(h => 
    refPatterns.some(p => h.includes(p)) && !h.includes('ean')
  );
  if (mapping.supplier_reference === -1) mapping.supplier_reference = null;

  // Brand patterns
  const brandPatterns = ['marque', 'brand', 'fabricant'];
  mapping.brand = normalizedHeaders.findIndex(h => 
    brandPatterns.some(p => h.includes(p))
  );
  if (mapping.brand === -1) mapping.brand = null;

  // Category patterns
  const categoryPatterns = ['catégorie', 'category', 'gamme', 'famille'];
  mapping.category = normalizedHeaders.findIndex(h => 
    categoryPatterns.some(p => h.includes(p))
  );
  if (mapping.category === -1) mapping.category = null;

  // VAT rate patterns
  const vatPatterns = ['tva', 'taux tva', 'tax'];
  mapping.vat_rate = normalizedHeaders.findIndex(h => 
    vatPatterns.some(p => h.includes(p))
  );
  if (mapping.vat_rate === -1) mapping.vat_rate = null;

  console.log('[suggestMapping] Suggested mapping:', mapping);
  return mapping;
}
