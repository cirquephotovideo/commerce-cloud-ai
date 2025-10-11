import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, AlertCircle, HelpCircle, Sparkles, Wand2, Trophy, TrendingUp } from "lucide-react";

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
  const [highlightedColumn, setHighlightedColumn] = useState<number | null>(null);
  const [autoDetected, setAutoDetected] = useState<string[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);

  // Smart parsers for complex formats
  const smartParsePrice = (value: string): number | null => {
    if (!value || value === '') return null;
    let cleaned = String(value).replace(/[€$£¥\s]/g, '').trim();
    const hasCommaDecimal = /\d+,\d{2}$/.test(cleaned);
    if (hasCommaDecimal) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  const smartParseEAN = (value: string): string | null => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    return digits.length === 13 ? digits : null;
  };

  const smartParseStock = (value: string): number | null => {
    if (!value) return null;
    const match = String(value).match(/\d+/);
    return match ? parseInt(match[0]) : null;
  };

  // Calculate confidence score with smart parsing
  const calculateConfidence = (fieldKey: string, columnName: string, columnValues: any[]): number => {
    const patterns = SMART_PATTERNS[fieldKey] || [];
    let score = 0;

    // Header name matching (40 points)
    const headerMatch = patterns.some(pattern => pattern.test(columnName));
    if (headerMatch) score += 40;

    // Data format validation with smart parsing (60 points)
    const validValues = columnValues.filter(v => v !== null && v !== undefined && v !== '');
    if (validValues.length === 0) return score;

    if (fieldKey === 'purchase_price') {
      const numericValues = validValues.filter(v => smartParsePrice(String(v)) !== null);
      score += Math.round((numericValues.length / validValues.length) * 60);
    } else if (fieldKey === 'ean') {
      const eanValues = validValues.filter(v => smartParseEAN(String(v)) !== null);
      score += Math.round((eanValues.length / validValues.length) * 60);
    } else if (fieldKey === 'stock_quantity') {
      const intValues = validValues.filter(v => smartParseStock(String(v)) !== null);
      score += Math.round((intValues.length / validValues.length) * 60);
    } else if (fieldKey === 'vat_rate') {
      const vatValues = validValues.filter(v => {
        const num = parseFloat(String(v).replace(',', '.'));
        return !isNaN(num) && num >= 0 && num <= 100;
      });
      score += Math.round((vatValues.length / validValues.length) * 60);
    } else {
      score += Math.round((validValues.length / columnValues.length) * 60);
    }

    return Math.min(100, score);
  };

  // Validate data format with smart parsing
  const isValidFormat = (fieldKey: string, value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;

    if (fieldKey === 'purchase_price') {
      return smartParsePrice(String(value)) !== null;
    } else if (fieldKey === 'ean') {
      return smartParseEAN(String(value)) !== null;
    } else if (fieldKey === 'stock_quantity') {
      return smartParseStock(String(value)) !== null;
    } else if (fieldKey === 'vat_rate') {
      const num = parseFloat(String(value).replace(',', '.'));
      return !isNaN(num) && num >= 0 && num <= 100;
    }
    return true;
  };

  // Calculate mapping quality score
  const calculateMappingQuality = (): number => {
    const requiredMapped = REQUIRED_FIELDS.every(f => mapping[f.key] !== null);
    const optionalMapped = OPTIONAL_FIELDS.filter(f => mapping[f.key] !== null).length;
    const avgConfidence = Object.values(confidence).length > 0
      ? Object.values(confidence).reduce((a, b) => a + b, 0) / Object.values(confidence).length
      : 0;
    
    return Math.round(
      (requiredMapped ? 40 : 0) +
      (optionalMapped / OPTIONAL_FIELDS.length) * 30 +
      (avgConfidence * 0.3)
    );
  };

  // Count invalid data
  useEffect(() => {
    let count = 0;
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach(field => {
      const columnIndex = mapping[field.key];
      if (columnIndex !== null && columnIndex !== undefined) {
        const headers = Object.keys(previewData[0] || {});
        const columnKey = headers[columnIndex];
        previewData.forEach(row => {
          if (!isValidFormat(field.key, row[columnKey])) {
            count++;
          }
        });
      }
    });
    setInvalidCount(count);
  }, [mapping, previewData]);

  const mappingQuality = calculateMappingQuality();

  // Auto-detect columns on mount with confidence scoring
  useEffect(() => {
    if (previewData.length === 0 || Object.keys(initialMapping).length > 0) return;

    const detectedMapping: Record<string, number | null> = {};
    const detectedConfidence: Record<string, number> = {};
    const detected: string[] = [];
    const headers = Object.keys(previewData[0] || {});

    // Try to auto-detect each field with confidence scoring
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach(field => {
      const patterns = SMART_PATTERNS[field.key] || [];
      let bestMatch = -1;
      let bestScore = 0;

      headers.forEach((header, index) => {
        const columnValues = previewData.map(row => row[header]);
        const score = calculateConfidence(field.key, header, columnValues);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = index;
        }
      });

      if (bestMatch !== -1 && bestScore > 30) {
        detectedMapping[field.key] = bestMatch;
        detectedConfidence[field.key] = bestScore;
        detected.push(field.key);
      } else {
        detectedMapping[field.key] = null;
        detectedConfidence[field.key] = 0;
      }
    });

    setMapping(detectedMapping);
    setConfidence(detectedConfidence);
    setAutoDetected(detected);
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
    const columnIndex = (value === '' || value === '__ignore__') ? null : parseInt(value);
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
      {/* Mapping Quality Score */}
      <Card className="border-2" style={{ borderColor: mappingQuality > 80 ? 'hsl(var(--primary))' : 'hsl(var(--orange))' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Qualité du mapping
            </CardTitle>
            <Badge variant={mappingQuality > 80 ? "default" : "secondary"} className="text-lg">
              {mappingQuality}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={mappingQuality} className="h-3" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Champs requis</div>
              <div className="font-bold">
                {REQUIRED_FIELDS.filter(f => mapping[f.key] !== null).length}/{REQUIRED_FIELDS.length}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Champs optionnels</div>
              <div className="font-bold">
                {OPTIONAL_FIELDS.filter(f => mapping[f.key] !== null).length}/{OPTIONAL_FIELDS.length}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Auto-détectés</div>
              <div className="font-bold flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                {autoDetected.length}
              </div>
            </div>
          </div>
          
          {mappingQuality === 100 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                  🎉 Mapping parfait!
                </AlertTitle>
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  Tous les champs sont mappés avec une confiance élevée
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {invalidCount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{invalidCount} valeurs avec format invalide détectées</span>
                <Button variant="ghost" size="sm" className="h-8">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Auto-corriger
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Validation Alert */}
      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Veuillez mapper au minimum: <strong>Nom du produit</strong> et <strong>Prix d'achat</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Mapping Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Configuration du mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
          {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
            const fieldConfidence = confidence[field.key] || 0;
            const isMapped = mapping[field.key] !== null && mapping[field.key] !== undefined;
            const isAutoDetected = autoDetected.includes(field.key);

            return (
              <motion.div
                key={field.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor={field.key} className="flex items-center gap-2">
                    {field.label}
                    {field.required && <Badge variant="destructive" className="h-5">Requis</Badge>}
                  </Label>
                  
                  <AnimatePresence>
                    {isAutoDetected && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                      >
                        <Badge variant="default" className="animate-pulse">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Auto-détecté à {fieldConfidence}%
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isMapped && !isAutoDetected && fieldConfidence > 0 && (
                    <Badge variant={fieldConfidence > 80 ? "default" : fieldConfidence > 50 ? "secondary" : "outline"}>
                      {fieldConfidence}%
                    </Badge>
                  )}
                  
                  {fieldConfidence < 50 && isMapped && (
                    <Popover>
                      <PopoverTrigger>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      </PopoverTrigger>
                      <PopoverContent>
                        <div className="space-y-2">
                          <div className="font-semibold">⚠️ Confiance faible</div>
                          <div className="text-xs text-muted-foreground">
                            Le mapping détecté pourrait ne pas être optimal. Vérifiez les données.
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                    <SelectItem value="__ignore__">Ignorer ce champ</SelectItem>
                    {Object.keys(previewData[0] || {}).map((header, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{header}</span>
                          {mapping[field.key] === index && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
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
                  {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field, fieldIdx) => {
                    const columnIndex = mapping[field.key];
                    const isMapped = columnIndex !== null && columnIndex !== undefined;
                    const isHighlighted = highlightedColumn === columnIndex;
                    
                    return (
                      <TableHead 
                        key={field.key}
                        onMouseEnter={() => isMapped && setHighlightedColumn(columnIndex)}
                        onMouseLeave={() => setHighlightedColumn(null)}
                        className={isHighlighted ? 'bg-primary/10' : ''}
                      >
                        <div className="flex items-center gap-2">
                          {field.label}
                          {isMapped && (
                            <Badge variant="secondary" className="text-xs">
                              Col {columnIndex}
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
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
                    const isHighlighted = highlightedColumn === columnIndex;

                    return (
                      <TableCell 
                        key={field.key}
                        className={isHighlighted ? 'bg-primary/5' : isMapped && isValid ? 'bg-green-50 dark:bg-green-950' : ''}
                      >
                        {isMapped ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px]">{value}</span>
                            {isValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Popover>
                                <PopoverTrigger>
                                  <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                </PopoverTrigger>
                                <PopoverContent>
                                  <div className="space-y-2">
                                    <div className="font-semibold">Format attendu:</div>
                                    <div className="text-xs">
                                      {field.key === 'purchase_price' && "Nombre décimal (ex: 19.99)"}
                                      {field.key === 'ean' && "13 chiffres (ex: 3760123456789)"}
                                      {field.key === 'stock_quantity' && "Nombre entier (ex: 45)"}
                                      {field.key === 'vat_rate' && "Pourcentage (ex: 20)"}
                                    </div>
                                    <div className="font-semibold mt-2">Valeur actuelle:</div>
                                    <code className="text-xs bg-muted p-1 rounded block">{value}</code>
                                  </div>
                                </PopoverContent>
                              </Popover>
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
