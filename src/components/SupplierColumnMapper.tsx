import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface SupplierColumnMapperProps {
  previewData: any[];
  onMappingChange: (mapping: Record<string, number | null>) => void;
  onConfidenceChange?: (confidence: Record<string, number>) => void;
  initialMapping?: Record<string, number | null>;
}

const SMART_PATTERNS: Record<string, RegExp[]> = {
  product_name: [
    /nom/i, /name/i, /libelle/i, /libellé/i, /designation/i, /désignation/i,
    /titre/i, /title/i, /produit/i, /product/i, /article/i, /description/i
  ],
  purchase_price: [
    /prix/i, /price/i, /cout/i, /coût/i, /cost/i, /tarif/i, /montant/i,
    /achat/i, /purchase/i, /\bpa\b/i, /buying/i, /wholesale/i
  ],
  ean: [
    /ean/i, /gtin/i, /barcode/i, /code.*barre/i, /upc/i, /isbn/i, /\bean\b/i
  ],
  supplier_reference: [
    /ref/i, /reference/i, /référence/i, /sku/i, /code/i, /article/i, /item/i
  ],
  stock_quantity: [
    /stock/i, /quantity/i, /quantité/i, /qty/i, /qte/i, /disponible/i, /available/i
  ],
  vat_rate: [
    /tva/i, /vat/i, /tax/i, /taxe/i, /rate/i, /taux/i
  ],
  category: [
    /categorie/i, /catégorie/i, /category/i, /famille/i, /family/i, /type/i
  ],
  brand: [
    /marque/i, /brand/i, /manufacturer/i, /fabricant/i, /maker/i
  ],
};

const REQUIRED_FIELDS = [
  { key: 'product_name', label: 'Nom du produit', required: true, tooltip: 'Le nom ou la désignation du produit' },
  { key: 'purchase_price', label: 'Prix d\'achat', required: true, tooltip: 'Le prix d\'achat HT' },
];

const OPTIONAL_FIELDS = [
  { key: 'ean', label: 'Code EAN', required: false, tooltip: 'Code-barres EAN13 (13 chiffres)' },
  { key: 'supplier_reference', label: 'Référence fournisseur', required: false, tooltip: 'Référence unique chez le fournisseur' },
  { key: 'stock_quantity', label: 'Stock disponible', required: false, tooltip: 'Quantité en stock' },
  { key: 'vat_rate', label: 'Taux TVA (%)', required: false, tooltip: 'Taux de TVA en pourcentage (ex: 20)' },
  { key: 'category', label: 'Catégorie', required: false, tooltip: 'Catégorie ou famille de produit' },
  { key: 'brand', label: 'Marque', required: false, tooltip: 'Marque du produit' },
];

export function SupplierColumnMapper({
  previewData,
  onMappingChange,
  onConfidenceChange,
  initialMapping = {}
}: SupplierColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, number | null>>(initialMapping);
  const [confidence, setConfidence] = useState<Record<string, number>>({});

  // Calculate confidence score for a field-column match
  const calculateConfidence = (fieldKey: string, columnName: string, columnValues: any[]): number => {
    const patterns = SMART_PATTERNS[fieldKey] || [];
    let score = 0;

    // Header name matching (40 points)
    const headerMatch = patterns.some(pattern => pattern.test(columnName));
    if (headerMatch) score += 40;

    // Data format validation (60 points)
    const validValues = columnValues.filter(v => v !== null && v !== undefined && v !== '');
    if (validValues.length === 0) return score;

    if (fieldKey === 'purchase_price') {
      const numericValues = validValues.filter(v => !isNaN(parseFloat(String(v).replace(',', '.'))));
      score += Math.round((numericValues.length / validValues.length) * 60);
    } else if (fieldKey === 'ean') {
      const eanValues = validValues.filter(v => /^\d{13}$/.test(String(v)));
      score += Math.round((eanValues.length / validValues.length) * 60);
    } else if (fieldKey === 'stock_quantity') {
      const intValues = validValues.filter(v => Number.isInteger(parseFloat(String(v))));
      score += Math.round((intValues.length / validValues.length) * 60);
    } else if (fieldKey === 'vat_rate') {
      const vatValues = validValues.filter(v => {
        const num = parseFloat(String(v).replace(',', '.'));
        return !isNaN(num) && num >= 0 && num <= 100;
      });
      score += Math.round((vatValues.length / validValues.length) * 60);
    } else {
      // For text fields, check non-empty
      score += Math.round((validValues.length / columnValues.length) * 60);
    }

    return Math.min(100, score);
  };

  // Validate data format
  const isValidFormat = (fieldKey: string, value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;

    if (fieldKey === 'purchase_price') {
      return !isNaN(parseFloat(String(value).replace(',', '.')));
    } else if (fieldKey === 'ean') {
      return /^\d{13}$/.test(String(value));
    } else if (fieldKey === 'stock_quantity') {
      return Number.isInteger(parseFloat(String(value)));
    } else if (fieldKey === 'vat_rate') {
      const num = parseFloat(String(value).replace(',', '.'));
      return !isNaN(num) && num >= 0 && num <= 100;
    }
    return true;
  };

  // Auto-detect columns on mount with confidence scoring
  useEffect(() => {
    if (previewData.length === 0 || Object.keys(initialMapping).length > 0) return;

    const detectedMapping: Record<string, number | null> = {};
    const detectedConfidence: Record<string, number> = {};
    const headers = Object.keys(previewData[0] || {});

    // Try to auto-detect each field with confidence scoring
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach(field => {
      const patterns = SMART_PATTERNS[field.key] || [];
      let bestMatch = -1;
      let bestScore = 0;

      headers.forEach((header, index) => {
        // Get column values for validation
        const columnValues = previewData.map(row => row[header]);
        const score = calculateConfidence(field.key, header, columnValues);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = index;
        }
      });

      if (bestMatch !== -1 && bestScore > 30) { // Minimum 30% confidence
        detectedMapping[field.key] = bestMatch;
        detectedConfidence[field.key] = bestScore;
      } else {
        detectedMapping[field.key] = null;
        detectedConfidence[field.key] = 0;
      }
    });

    setMapping(detectedMapping);
    setConfidence(detectedConfidence);
    onMappingChange(detectedMapping);
    if (onConfidenceChange) {
      onConfidenceChange(detectedConfidence);
    }
  }, [previewData]);

  // Update mapping when user changes selection
  useEffect(() => {
    onMappingChange(mapping);
    if (onConfidenceChange) {
      onConfidenceChange(confidence);
    }
  }, [mapping, confidence]);

  const handleMappingChange = (field: string, value: string) => {
    const columnIndex = value === '' ? null : parseInt(value);
    setMapping(prev => ({
      ...prev,
      [field]: columnIndex
    }));

    // Recalculate confidence when manually changed
    if (columnIndex !== null) {
      const headers = Object.keys(previewData[0] || {});
      const header = headers[columnIndex];
      const columnValues = previewData.map(row => row[header]);
      const score = calculateConfidence(field, header, columnValues);
      setConfidence(prev => ({
        ...prev,
        [field]: score
      }));
    } else {
      setConfidence(prev => ({
        ...prev,
        [field]: 0
      }));
    }
  };

  const isValid = REQUIRED_FIELDS.every(field =>
    mapping[field.key] !== null && mapping[field.key] !== undefined
  );

  if (previewData.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucune donnée de prévisualisation disponible. Veuillez d'abord charger un fichier.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Alert */}
      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Veuillez mapper au minimum: <strong>Nom du produit</strong> et <strong>Prix d'achat</strong>
          </AlertDescription>
        </Alert>
      )}

      {isValid && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✅ Mapping valide!
          </AlertDescription>
        </Alert>
      )}

      {/* Mapping Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Configuration du mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Required Fields */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Badge variant="destructive">Obligatoire</Badge>
              Champs requis
            </h4>
          {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
            const fieldConfidence = confidence[field.key] || 0;
            const isMapped = mapping[field.key] !== null && mapping[field.key] !== undefined;

            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {isMapped && fieldConfidence > 0 && (
                    <Badge variant={fieldConfidence > 80 ? "default" : fieldConfidence > 50 ? "secondary" : "outline"}>
                      {fieldConfidence}%
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{field.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={mapping[field.key]?.toString() || ''}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger id={field.key}>
                    <SelectValue placeholder="Sélectionner une colonne..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ignorer ce champ</SelectItem>
                    {Object.keys(previewData[0] || {}).map((header, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          </div>
        </CardContent>
      </Card>

      {/* Preview with Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>👁️ Aperçu avec mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                    <TableHead key={field.key}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.slice(0, 5).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                  {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
                    const columnIndex = mapping[field.key];
                    const isMapped = columnIndex !== null && columnIndex !== undefined;
                    const columnKey = isMapped ? Object.keys(previewData[0])[columnIndex] : null;
                    const value = columnKey ? row[columnKey] : null;
                    const isValid = isMapped && isValidFormat(field.key, value);

                    return (
                      <TableCell key={field.key}>
                        {isMapped ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px]">{value}</span>
                            {isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Format invalide pour {field.label}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non mappé</span>
                        )}
                      </TableCell>
                    );
                  })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
