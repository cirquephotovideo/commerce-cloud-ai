import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface EmailMappingDialogProps {
  email: {
    id: string;
    attachment_name: string;
    attachment_url: string;
    attachment_type: string;
    supplier_id?: string;
    detected_supplier_name?: string;
  };
  onClose: () => void;
  onConfirm: () => void;
}

export function EmailMappingDialog({ email, onClose, onConfirm }: EmailMappingDialogProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [savedMapping, setSavedMapping] = useState<any>(null);
  const [confidence, setConfidence] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPreviewAndMapping();
  }, [email.id]);

  const loadPreviewAndMapping = async () => {
    setLoading(true);
    try {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('email-attachments')
        .download(email.attachment_url);

      if (downloadError) throw downloadError;

      // Parse file to get preview (first 5 rows)
      const arrayBuffer = await fileData.arrayBuffer();
      let rows: any[] = [];

      if (email.attachment_type === 'csv') {
        const text = new TextDecoder().decode(arrayBuffer);
        const lines = text.split('\n').slice(0, 6); // header + 5 rows
        const headers = lines[0].split(/[;,\t]/);
        rows = lines.slice(1, 6).map(line => {
          const values = line.split(/[;,\t]/);
          return headers.reduce((obj, header, idx) => {
            obj[header.trim()] = values[idx]?.trim() || '';
            return obj;
          }, {} as Record<string, string>);
        }).filter(row => Object.values(row).some(v => v));
      } else {
        // Excel
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(firstSheet);
        rows = allRows.slice(0, 5);
      }

      setPreviewData(rows);

      // Load saved mapping if supplier exists
      if (email.supplier_id) {
        const { data: supplierConfig } = await supabase
          .from('supplier_configurations')
          .select('column_mapping')
          .eq('id', email.supplier_id)
          .single();

        if (supplierConfig?.column_mapping) {
          setSavedMapping(supplierConfig.column_mapping);
          // Convert AI mapping format to SupplierColumnMapper format
          const convertedMapping: Record<string, number | null> = {};
          Object.entries(supplierConfig.column_mapping).forEach(([field, colName]) => {
            if (colName && typeof colName === 'string' && rows.length > 0) {
              const colIndex = Object.keys(rows[0]).indexOf(colName);
              convertedMapping[field] = colIndex >= 0 ? colIndex : null;
            }
          });
          setMapping(convertedMapping);
        }
      }
    } catch (error: any) {
      console.error('Preview load error:', error);
      toast.error("Erreur lors du chargement de l'aperçu");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Convert mapping to AI format (field -> column name)
      const columnNames = previewData.length > 0 ? Object.keys(previewData[0]) : [];
      const aiMapping: Record<string, string | null> = {};
      Object.entries(mapping).forEach(([field, colIndex]) => {
        aiMapping[field] = colIndex !== null ? columnNames[colIndex] : null;
      });

      // Save mapping to supplier configuration
      if (email.supplier_id) {
        await supabase
          .from('supplier_configurations')
          .update({ column_mapping: aiMapping })
          .eq('id', email.supplier_id);
      }

      // Process email with mapping
      const { error } = await supabase.functions.invoke('process-email-attachment', {
        body: {
          inbox_id: email.id,
          user_id: user.id,
          custom_mapping: aiMapping
        },
      });

      if (error) throw error;

      toast.success("Traitement lancé avec le mapping personnalisé");
      onConfirm();
      onClose();
    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error("Erreur lors du traitement");
    } finally {
      setProcessing(false);
    }
  };

  const isValidMapping = () => {
    // Check required fields
    return mapping.product_name !== null && mapping.purchase_price !== null;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Valider le mapping - {email.attachment_name}
          </DialogTitle>
          <DialogDescription>
            Vérifiez et ajustez le mapping des colonnes avant le traitement
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Chargement de l'aperçu...
          </div>
        ) : (
          <div className="space-y-4">
            {savedMapping && (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Un mapping sauvegardé a été trouvé pour ce fournisseur. Vous pouvez l'ajuster si nécessaire.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Aperçu des données (5 premières lignes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.length > 0 && Object.keys(previewData[0]).map((col, idx) => (
                          <TableHead key={idx} className="min-w-[150px]">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {Object.values(row).map((cell: any, cellIdx) => (
                            <TableCell key={cellIdx} className="text-sm">
                              {String(cell || '-')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <SupplierColumnMapper
              previewData={previewData}
              onMappingChange={setMapping}
              onConfidenceChange={setConfidence}
              initialMapping={mapping}
            />

            {!isValidMapping() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Les champs obligatoires "Nom du produit" et "Prix d'achat" doivent être mappés
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || !isValidMapping() || processing}
          >
            {processing ? (
              <>Traitement en cours...</>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmer et traiter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
