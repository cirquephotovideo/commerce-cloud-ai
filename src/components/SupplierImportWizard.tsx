import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Seuls les fichiers CSV sont acceptés");
        return;
      }
      setFile(selectedFile);
      previewFile(selectedFile);
    }
  };

  const previewFile = async (file: File) => {
    const text = await file.text();
    const allLines = text.split("\n");
    const lines = allLines.slice(skipFirstRow ? 1 : 0, 6);
    const parsed = lines.map(line => line.split(delimiter));
    setPreview(parsed);
  };

  const handleImport = async () => {
    if (!file || !supplierId) {
      toast.error("Veuillez sélectionner un fournisseur et un fichier");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      
      const { data, error } = await supabase.functions.invoke("supplier-import-csv", {
        body: {
          supplierId,
          csvContent: text,
          delimiter,
          skipFirstRow,
        },
      });

      if (error) throw error;

      toast.success(`Importation réussie: ${data.imported} produits importés`);
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erreur lors de l'importation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assistant d'importation CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Supplier selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sélectionner un fournisseur</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un fournisseur..." />
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

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!supplierId}>
                  Suivant
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: File upload */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Cliquez pour sélectionner un fichier CSV
                        </p>
                        {file && (
                          <p className="text-sm font-medium mt-2 flex items-center gap-2 justify-center">
                            <FileText className="h-4 w-4" />
                            {file.name}
                          </p>
                        )}
                      </div>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Séparateur</Label>
                  <Input
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    maxLength={1}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <input
                    type="checkbox"
                    id="skip-first"
                    checked={skipFirstRow}
                    onChange={(e) => setSkipFirstRow(e.target.checked)}
                  />
                  <Label htmlFor="skip-first">Ignorer la première ligne (en-têtes)</Label>
                </div>
              </div>

              {preview.length > 0 && (
                <div className="border rounded-lg p-4 overflow-x-auto">
                  <p className="text-sm font-medium mb-2">Aperçu:</p>
                  <pre className="text-xs">
                    {preview.map((row, i) => (
                      <div key={i}>{row.join(" | ")}</div>
                    ))}
                  </pre>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button onClick={handleImport} disabled={!file || loading}>
                  {loading ? "Importation..." : "Importer"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
