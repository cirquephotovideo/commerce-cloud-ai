import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import * as XLSX from "xlsx";

interface SupplierImportWizardProps {
  onClose: () => void;
}

export function SupplierImportWizard({ onClose }: SupplierImportWizardProps) {
  const [step, setStep] = useState(1);
  const [supplierId, setSupplierId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [delimiter, setDelimiter] = useState(";");
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [preview, setPreview] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isCSV = selectedFile.name.endsWith(".csv");
      const isXLSX = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");
      
      if (!isCSV && !isXLSX) {
        toast.error("Seuls les fichiers CSV et XLSX sont acceptés");
        return;
      }
      setFile(selectedFile);
      previewFile(selectedFile);
    }
  };

  const previewFile = async (file: File) => {
    const isXLSX = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    
    if (isXLSX) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      setPreview(jsonData.slice(0, 6));
    } else {
      const text = await file.text();
      const allLines = text.split("\n");
      const lines = allLines.slice(0, 6);
      const parsed = lines.map(line => line.split(delimiter));
      setPreview(parsed);
    }
  };

  const handleImport = async () => {
    if (!file || !supplierId) {
      toast.error("Veuillez sélectionner un fournisseur et un fichier");
      return;
    }

    // Validate required mappings
    const hasName = columnMapping.product_name !== null && columnMapping.product_name !== undefined;
    const hasPrice = columnMapping.purchase_price !== null && columnMapping.purchase_price !== undefined;
    
    if (!hasName || !hasPrice) {
      toast.error("Veuillez mapper au minimum le nom du produit et le prix d'achat");
      return;
    }

    setLoading(true);
    try {
      const isXLSX = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      
      // Save column mapping to supplier configuration
      await supabase
        .from('supplier_configurations')
        .update({ column_mapping: columnMapping })
        .eq('id', supplierId);
      
      if (isXLSX) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        const { data, error } = await supabase.functions.invoke("supplier-import-xlsx", {
          body: {
            supplierId,
            fileContent: base64,
            skipFirstRow,
            columnMapping,
          },
        });

        if (error) throw error;
        toast.success(`✅ Import réussi: ${data.imported} produits importés`);
      } else {
        const text = await file.text();
        
        const { data, error } = await supabase.functions.invoke("supplier-import-csv", {
          body: {
            supplierId,
            fileContent: text,
            delimiter,
            skipFirstRow,
            columnMapping,
          },
        });

        if (error) throw error;
        toast.success(`✅ Import réussi: ${data.imported} produits importés`);
      }
      
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("❌ Erreur lors de l'importation");
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep3 = file && preview.length > 0;
  const canImport = columnMapping.product_name !== null && columnMapping.purchase_price !== null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            📥 Assistant d'import CSV/XLSX - Étape {step}/3
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Supplier & File */}
          {step === 1 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Fournisseur</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fichier CSV ou XLSX</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                    />
                    {file && <FileText className="h-5 w-5 text-green-500" />}
                  </div>
                </div>

                {file?.name.endsWith(".csv") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Séparateur</Label>
                      <Select value={delimiter} onValueChange={setDelimiter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=";">Point-virgule (;)</SelectItem>
                          <SelectItem value=",">Virgule (,)</SelectItem>
                          <SelectItem value="\t">Tabulation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-8">
                      <input
                        type="checkbox"
                        id="skip-first"
                        checked={skipFirstRow}
                        onChange={(e) => {
                          setSkipFirstRow(e.target.checked);
                          if (file) previewFile(file);
                        }}
                      />
                      <Label htmlFor="skip-first">Ignorer la première ligne (en-têtes)</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Preview */}
          {step === 2 && preview.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">👁️ Aperçu du fichier (premières lignes)</h3>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className={i === 0 ? "font-bold bg-muted" : "hover:bg-muted/50"}>
                          {row.map((cell: any, j: number) => (
                            <td key={j} className="p-2 border-r last:border-r-0">
                              {String(cell || '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Column Mapping */}
          {step === 3 && (
            <SupplierColumnMapper
              previewData={preview}
              onMappingChange={setColumnMapping}
              initialMapping={columnMapping}
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between border-t pt-4">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Précédent
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              
              {step === 1 && (
                <Button onClick={() => setStep(2)} disabled={!supplierId || !file}>
                  Suivant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              
              {step === 2 && (
                <Button onClick={() => setStep(3)} disabled={!canProceedToStep3}>
                  Suivant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              
              {step === 3 && (
                <Button onClick={handleImport} disabled={!canImport || loading}>
                  {loading ? (
                    <>
                      <FileText className="mr-2 h-4 w-4 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Lancer l'import
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
