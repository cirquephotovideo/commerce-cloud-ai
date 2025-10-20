import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { SupplierColumnMapper } from "./SupplierColumnMapper";

interface EmailMappingValidationProps {
  email: any;
  detectedColumns: string[];
  previewData: any[];
  suggestedMapping: Record<string, number | null>;
  onConfirm: (mapping: Record<string, number | null>) => void;
  onCancel: () => void;
}

export function EmailMappingValidation({
  email,
  detectedColumns,
  previewData,
  suggestedMapping,
  onConfirm,
  onCancel
}: EmailMappingValidationProps) {
  const [mapping, setMapping] = useState<Record<string, number | null>>(suggestedMapping);
  const [confidence, setConfidence] = useState<Record<string, number>>({});

  // Validation stricte : nom + prix + (EAN OU référence fournisseur)
  const isValid = 
    mapping.product_name !== null && 
    mapping.purchase_price !== null &&
    (mapping.ean !== null || mapping.supplier_reference !== null);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🔍 Vérifier le mapping avant import</DialogTitle>
          <DialogDescription>
            Le fichier "<strong>{email.attachment_name}</strong>" contient <strong>{detectedColumns.length} colonnes</strong>.
            Validez le mapping détecté ou corrigez-le manuellement avant de lancer l'import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Colonnes détectées */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📋 Colonnes détectées dans le fichier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {detectedColumns.map((col, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {idx}: {col}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Validation alert */}
          {!isValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Champs obligatoires : <strong>Nom du produit</strong>, <strong>Prix d'achat</strong> ET <strong>EAN ou Référence fournisseur</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Mapping configuration */}
          <SupplierColumnMapper
            previewData={previewData}
            initialMapping={suggestedMapping}
            onMappingChange={setMapping}
            onConfidenceChange={setConfidence}
          />

          {/* Preview with validation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">👁️ Aperçu des 5 premières lignes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b">
                      {detectedColumns.map((col, idx) => {
                        const isMapped = Object.values(mapping).includes(idx);
                        return (
                          <th 
                            key={idx} 
                            className={`p-2 text-left ${isMapped ? 'bg-primary/10 font-bold' : ''}`}
                          >
                            {col}
                            {isMapped && (
                              <Badge variant="default" className="ml-2 text-[10px]">
                                Mappé
                              </Badge>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b hover:bg-muted/50">
                        {detectedColumns.map((col, colIdx) => {
                          const isMapped = Object.values(mapping).includes(colIdx);
                          return (
                            <td 
                              key={colIdx} 
                              className={`p-2 ${isMapped ? 'font-medium' : 'text-muted-foreground'}`}
                            >
                              {row[col] || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(mapping)} disabled={!isValid}>
            ✅ Confirmer et importer ({previewData.length} lignes)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
