import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupplierColumnMapperProps {
  previewData: any[][];
  onMappingChange: (mapping: Record<string, number | null>) => void;
  initialMapping?: Record<string, number | null>;
}

const REQUIRED_FIELDS = [
  { key: "product_name", label: "Nom du produit", required: true },
  { key: "purchase_price", label: "Prix d'achat", required: true },
];

const OPTIONAL_FIELDS = [
  { key: "ean", label: "EAN/Code-barres", required: false },
  { key: "supplier_reference", label: "Référence fournisseur", required: false },
  { key: "stock_quantity", label: "Stock disponible", required: false },
  { key: "description", label: "Description", required: false },
  { key: "brand", label: "Marque", required: false },
  { key: "category", label: "Catégorie", required: false },
];

export function SupplierColumnMapper({ 
  previewData, 
  onMappingChange,
  initialMapping = {}
}: SupplierColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, number | null>>(initialMapping);
  
  // Use first row as headers, next 3 rows as data examples
  const headers = previewData.length > 0 ? previewData[0] : [];
  const dataRows = previewData.length > 1 ? previewData.slice(1, 4) : [];

  useEffect(() => {
    // Auto-detect columns based on common patterns
    const autoMapping: Record<string, number | null> = {};
    
    headers.forEach((header: string, index: number) => {
      const headerLower = String(header).toLowerCase();
      
      // Auto-detect name
      if (headerLower.includes('nom') || headerLower.includes('name') || headerLower.includes('libelle')) {
        autoMapping.product_name = index;
      }
      // Auto-detect price
      if (headerLower.includes('prix') || headerLower.includes('price') || headerLower.includes('cout')) {
        autoMapping.purchase_price = index;
      }
      // Auto-detect EAN
      if (headerLower.includes('ean') || headerLower.includes('barcode') || headerLower.includes('gtin')) {
        autoMapping.ean = index;
      }
      // Auto-detect reference
      if (headerLower.includes('ref') || headerLower.includes('sku') || headerLower.includes('code')) {
        autoMapping.supplier_reference = index;
      }
      // Auto-detect stock
      if (headerLower.includes('stock') || headerLower.includes('quantite') || headerLower.includes('quantity')) {
        autoMapping.stock_quantity = index;
      }
      // Auto-detect description
      if (headerLower.includes('desc') || headerLower.includes('detail')) {
        autoMapping.description = index;
      }
      // Auto-detect brand
      if (headerLower.includes('marque') || headerLower.includes('brand') || headerLower.includes('fabricant')) {
        autoMapping.brand = index;
      }
      // Auto-detect category
      if (headerLower.includes('categorie') || headerLower.includes('category')) {
        autoMapping.category = index;
      }
    });

    setMapping(prev => ({ ...autoMapping, ...prev }));
  }, [previewData]);

  useEffect(() => {
    onMappingChange(mapping);
  }, [mapping, onMappingChange]);

  const handleMappingChange = (field: string, value: string) => {
    const newMapping = { ...mapping };
    
    // Remove old mapping for this column index
    const columnIndex = value === "none" ? null : parseInt(value);
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === columnIndex && key !== field) {
        newMapping[key] = null;
      }
    });
    
    newMapping[field] = columnIndex;
    setMapping(newMapping);
  };

  const isValid = REQUIRED_FIELDS.every(field => 
    mapping[field.key] !== null && mapping[field.key] !== undefined
  );

  return (
    <div className="space-y-6">
      {/* Validation Alert */}
      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Veuillez mapper au minimum les champs obligatoires : <strong>Nom du produit</strong> et <strong>Prix d'achat</strong>
          </AlertDescription>
        </Alert>
      )}

      {isValid && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Le mapping est valide ! Vous pouvez procéder à l'import.
          </AlertDescription>
        </Alert>
      )}

      {/* Mapping Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Configuration du mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Required Fields */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Badge variant="destructive">Obligatoire</Badge>
              Champs requis
            </h4>
            {REQUIRED_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                <Label className="text-sm font-medium">
                  {field.label} *
                </Label>
                <Select
                  value={mapping[field.key]?.toString() ?? "none"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une colonne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Non mappé --</SelectItem>
                    {headers.map((header: string, index: number) => (
                      <SelectItem key={index} value={index.toString()}>
                        Colonne {index + 1}: {String(header)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Optional Fields */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Badge variant="secondary">Optionnel</Badge>
              Champs supplémentaires
            </h4>
            {OPTIONAL_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                <Label className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </Label>
                <Select
                  value={mapping[field.key]?.toString() ?? "none"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une colonne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Non mappé --</SelectItem>
                    {headers.map((header: string, index: number) => (
                      <SelectItem key={index} value={index.toString()}>
                        Colonne {index + 1}: {String(header)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview with Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>👁️ Aperçu avec mapping appliqué</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Champ</TableHead>
                <TableHead>Exemple 1</TableHead>
                <TableHead>Exemple 2</TableHead>
                <TableHead>Exemple 3</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(field => {
                const columnIndex = mapping[field.key];
                const isRequired = field.required;
                const isMapped = columnIndex !== null && columnIndex !== undefined;
                
                return (
                  <TableRow key={field.key} className={!isMapped && isRequired ? "bg-red-50 dark:bg-red-950/20" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {field.label}
                        {isRequired && <Badge variant="destructive" className="text-xs">*</Badge>}
                      </div>
                    </TableCell>
                    {dataRows.map((row, rowIndex) => (
                      <TableCell key={rowIndex}>
                        {isMapped ? (
                          <span className="text-sm">{String(row[columnIndex] || '-')}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Non mappé</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
