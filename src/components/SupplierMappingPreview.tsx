import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Check, X, RefreshCw, Save, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import * as XLSX from "xlsx";

interface SupplierMappingPreviewProps {
  supplierId: string;
}

export function SupplierMappingPreview({ supplierId }: SupplierMappingPreviewProps) {
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [lastFile, setLastFile] = useState<{ name: string; url: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [validationStats, setValidationStats] = useState({ valid: 0, invalid: 0, total: 0 });

  useEffect(() => {
    loadMappingAndFile();
  }, [supplierId]);

  const loadMappingAndFile = async () => {
    try {
      setIsLoading(true);

      // 1. Charger le mapping existant
      const { data: supplierConfig, error: configError } = await supabase
        .from('supplier_configurations')
        .select('column_mapping')
        .eq('id', supplierId)
        .single();

      if (configError) throw configError;

      if (supplierConfig?.column_mapping) {
        setMapping(supplierConfig.column_mapping as Record<string, number | null>);
      }

      // 2. Récupérer le dernier fichier email
      const { data: lastEmail, error: emailError } = await supabase
        .from('email_inbox')
        .select('attachment_url, attachment_name')
        .eq('supplier_id', supplierId)
        .not('attachment_url', 'is', null)
        .in('status', ['processed', 'success', 'failed'])
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (emailError) throw emailError;

      if (lastEmail?.attachment_url) {
        setLastFile({ name: lastEmail.attachment_name || 'fichier.xlsx', url: lastEmail.attachment_url });
        await loadAndParseFile(lastEmail.attachment_url, supplierConfig?.column_mapping as any);
      } else {
        toast.info("Aucun fichier reçu pour ce fournisseur");
      }
    } catch (error) {
      console.error('Error loading mapping:', error);
      toast.error("Erreur lors du chargement du mapping");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAndParseFile = async (fileUrl: string, currentMapping?: any) => {
    try {
      // Télécharger le fichier depuis Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('email-attachments')
        .download(fileUrl);

      if (downloadError) throw downloadError;

      // Parser le fichier Excel
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Detect header row using same logic as edge function
      function detectHeaderRow(rows: any[][]): number {
        const keywords = [
          'prix', 'tarif', 'référence', 'ref', 'code', 'ean', 
          'produit', 'article', 'désignation', 'description',
          'stock', 'quantité', 'marque', 'catégorie'
        ];
        
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          const nonEmptyCols = row.filter((c: any) => c && String(c).trim()).length;
          
          if (nonEmptyCols >= 5) {
            const rowText = row.join(' ').toLowerCase();
            const matchCount = keywords.filter(kw => rowText.includes(kw)).length;
            
            if (matchCount >= 3) {
              const nextRow = rows[i + 1];
              if (nextRow && nextRow.some((c: any) => c)) {
                return i;
              }
            }
          }
        }
        return 0;
      }

      const detectedHeaderRow = detectHeaderRow(rawRows as any[][]);
      setHeaderRowIndex(detectedHeaderRow);

      const headers = rawRows[detectedHeaderRow] as string[];
      const dataRows = rawRows.slice(detectedHeaderRow + 1, detectedHeaderRow + 11).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = (row as any)[i]);
        return obj;
      });

      setPreviewData([headers, ...dataRows]);

      // Calculer les statistiques de validation
      if (currentMapping) {
        calculateValidationStats(dataRows, currentMapping, headers);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error("Erreur lors de la lecture du fichier");
    }
  };

  const calculateValidationStats = (dataRows: any[], currentMapping: any, headers: string[]) => {
    let valid = 0;
    let invalid = 0;

    dataRows.forEach(row => {
      const price = currentMapping.purchase_price !== null ? row[headers[currentMapping.purchase_price]] : null;
      const name = currentMapping.product_name !== null ? row[headers[currentMapping.product_name]] : null;

      // Valider le prix
      const priceValid = price && !isNaN(parseFloat(String(price).replace(',', '.')));
      // Valider le nom
      const nameValid = name && String(name).trim().length > 0;

      if (priceValid && nameValid) {
        valid++;
      } else {
        invalid++;
      }
    });

    setValidationStats({ valid, invalid, total: dataRows.length });
  };

  const handleSaveMapping = async () => {
    if (!mapping.product_name || !mapping.purchase_price) {
      toast.error("Veuillez mapper au minimum le nom du produit et le prix d'achat");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('supplier_configurations')
        .update({ 
          column_mapping: mapping,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplierId);

      if (error) throw error;

      toast.success("✅ Mapping sauvegardé avec succès");
      setIsEditMode(false);
      
      // Recalculer les stats avec le nouveau mapping
      if (previewData.length > 1) {
        const headers = previewData[0];
        const dataRows = previewData.slice(1);
        calculateValidationStats(dataRows, mapping, headers);
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestMapping = () => {
    if (lastFile && previewData.length > 0) {
      const headers = previewData[0];
      const dataRows = previewData.slice(1);
      calculateValidationStats(dataRows, mapping, headers);
      toast.success("Mapping testé avec succès");
    }
  };

  const isColumnMapped = (colIndex: number): string | null => {
    for (const [field, index] of Object.entries(mapping)) {
      if (index === colIndex) return field;
    }
    return null;
  };

  const isValueValid = (value: any, fieldType: string): boolean => {
    if (!value) return false;

    switch (fieldType) {
      case 'purchase_price':
        return !isNaN(parseFloat(String(value).replace(',', '.')));
      case 'product_name':
        return String(value).trim().length > 0;
      case 'ean':
        return /^\d{13}$/.test(String(value).replace(/\s/g, ''));
      default:
        return true;
    }
  };

  if (isLoading && !previewData.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!lastFile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            État du mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aucun fichier reçu pour ce fournisseur. Le mapping ne peut pas être visualisé.
              Configurez d'abord le mapping via l'onglet "Configurer mapping".
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const headers = previewData[0] || [];
  const dataRows = previewData.slice(1);
  const qualityScore = validationStats.total > 0 
    ? Math.round((validationStats.valid / validationStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* En-tête avec stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              État du mapping
              {headerRowIndex > 0 && (
                <Badge variant="outline" className="ml-2">
                  En-têtes ligne {headerRowIndex + 1}
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <Button onClick={() => setIsEditMode(true)} variant="outline" size="sm">
                  Modifier le mapping
                </Button>
              ) : (
                <>
                  <Button onClick={() => setIsEditMode(false)} variant="ghost" size="sm">
                    Annuler
                  </Button>
                  <Button onClick={handleTestMapping} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tester
                  </Button>
                  <Button onClick={handleSaveMapping} disabled={isLoading} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Dernier fichier : <span className="font-medium">{lastFile.name}</span>
            </div>
            {validationStats.total > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  Score qualité : <span className={`font-bold ${qualityScore >= 80 ? 'text-green-600' : qualityScore >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                    {qualityScore}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    {validationStats.valid} valides
                  </Badge>
                  {validationStats.invalid > 0 && (
                    <Badge variant="destructive">
                      <X className="h-3 w-3 mr-1" />
                      {validationStats.invalid} invalides
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {Object.keys(mapping).length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Aucun mapping configuré. Cliquez sur "Modifier le mapping" pour commencer.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Mode édition : Afficher le SupplierColumnMapper */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration du mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierColumnMapper
              previewData={previewData}
              onMappingChange={setMapping}
              initialMapping={mapping}
            />
          </CardContent>
        </Card>
      )}

      {/* Tableau de preview */}
      {!isEditMode && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu des données avec mapping actuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header: string, index: number) => {
                      const mappedField = isColumnMapped(index);
                      return (
                        <TableHead key={index} className="whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{header}</span>
                            {mappedField && (
                              <Badge variant="default" className="text-xs">
                                {mappedField === 'product_name' && '📦 Nom'}
                                {mappedField === 'purchase_price' && '💰 Prix'}
                                {mappedField === 'ean' && '🔢 EAN'}
                                {mappedField === 'stock' && '📊 Stock'}
                                {mappedField === 'brand' && '🏷️ Marque'}
                                {!['product_name', 'purchase_price', 'ean', 'stock', 'brand'].includes(mappedField) && mappedField}
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataRows.map((row: any, rowIndex: number) => (
                    <TableRow key={rowIndex}>
                      {headers.map((header: string, colIndex: number) => {
                        const value = row[header];
                        const mappedField = isColumnMapped(colIndex);
                        const isValid = mappedField ? isValueValid(value, mappedField) : true;

                        return (
                          <TableCell key={colIndex} className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={!isValid ? 'text-red-600 font-medium' : ''}>
                                {value !== null && value !== undefined ? String(value) : '-'}
                              </span>
                              {mappedField && (
                                isValid ? (
                                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                                )
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Affichage des 10 premières lignes du fichier
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
