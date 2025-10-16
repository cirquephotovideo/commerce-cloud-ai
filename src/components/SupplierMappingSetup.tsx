import { useState, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, Save } from "lucide-react";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SupplierMappingSetupProps {
  supplierId: string;
}

export function SupplierMappingSetup({ supplierId }: SupplierMappingSetupProps) {
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      // Parse file to extract columns
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = rows[0] as string[];
      const dataRows = rows.slice(1, 6).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = (row as any)[i]);
        return obj;
      });
      
      setDetectedColumns(headers);
      setPreviewData([headers, ...dataRows]);
      setSampleFile(file);
      toast.success(`${headers.length} colonnes détectées dans le fichier`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error("Erreur lors de la lecture du fichier");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!mapping.product_name || !mapping.purchase_price) {
      toast.error("Veuillez mapper au minimum le nom du produit et le prix d'achat");
      return;
    }

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('supplier_configurations')
        .update({ column_mapping: mapping })
        .eq('id', supplierId);

      if (error) throw error;

      toast.success("✅ Mapping sauvegardé pour ce fournisseur");
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🗺️ Configuration préventive du mapping
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Configurez le mapping AVANT de recevoir les emails automatiques pour éviter les erreurs d'import.
            Téléversez un fichier exemple pour détecter les colonnes.
          </AlertDescription>
        </Alert>

        {/* File upload */}
        <div className="space-y-2">
          <Label htmlFor="sample-file">
            1️⃣ Téléverser un fichier exemple (.xls, .xlsx, .csv)
          </Label>
          <div className="flex gap-2">
            <Input
              id="sample-file"
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            {sampleFile && (
              <Button variant="outline" size="sm" onClick={() => {
                setSampleFile(null);
                setDetectedColumns([]);
                setPreviewData([]);
                setMapping({});
              }}>
                Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {/* Column mapping */}
        {detectedColumns.length > 0 && (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ✅ <strong>{detectedColumns.length} colonnes détectées.</strong> 
                Mappez au minimum le nom du produit et le prix d'achat.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>2️⃣ Configurer le mapping des colonnes</Label>
              <SupplierColumnMapper
                previewData={previewData}
                onMappingChange={setMapping}
                initialMapping={mapping}
              />
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={!mapping.product_name || !mapping.purchase_price || isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                💾 Sauvegarder le mapping pour ce fournisseur
              </Button>
            </div>
          </>
        )}

        {detectedColumns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Téléversez un fichier exemple pour commencer</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
