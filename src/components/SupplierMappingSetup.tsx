import { useState, ChangeEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, Save, RefreshCw } from "lucide-react";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectHeaderRow, normalizeHeader } from "@/lib/detectHeaderRow";
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
  const [skipRows, setSkipRows] = useState<number>(0);

  // Charger le mapping existant au montage
  useEffect(() => {
    loadExistingMapping();
  }, [supplierId]);

  const loadExistingMapping = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_configurations')
        .select('column_mapping, skip_rows')
        .eq('id', supplierId)
        .single();

      if (error) throw error;

      if (data?.column_mapping) {
        setMapping(data.column_mapping as Record<string, number | null>);
      }
      if (data?.skip_rows !== undefined) {
        setSkipRows(data.skip_rows);
      }
    } catch (error) {
      console.error('Error loading existing mapping:', error);
    }
  };

  const loadLastReceivedFile = async () => {
    try {
      setIsLoading(true);

      // Récupérer le dernier fichier email
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

      if (!lastEmail?.attachment_url) {
        toast.info("Aucun fichier reçu pour ce fournisseur");
        return;
      }

      // Télécharger et parser le fichier
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('email-attachments')
        .download(lastEmail.attachment_url);

      if (downloadError) throw downloadError;

      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Use skipRows if manually configured, otherwise auto-detect
      const headerRowIndex = skipRows > 0 ? skipRows : detectHeaderRow(rawRows);
      const headers = (rawRows[headerRowIndex] || []).map((h: any, i: number) => 
        normalizeHeader(h) || `Col ${i}`
      );
      const dataRows = rawRows.slice(headerRowIndex + 1);

      setDetectedColumns(headers);
      const preview = dataRows.slice(0, 5).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => obj[h] = (row as any)[i]);
        return obj;
      });
      setPreviewData(preview);
      
      if (headerRowIndex > 0) {
        toast.success(`✅ "${lastEmail.attachment_name}" - En-têtes ligne ${headerRowIndex + 1}`, {
          description: `${headers.length} colonnes détectées`
        });
      } else {
        toast.success(`✅ "${lastEmail.attachment_name}" - ${headers.length} colonnes`);
      }
    } catch (error) {
      console.error('Error loading last file:', error);
      toast.error("Erreur lors du chargement du dernier fichier");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Use skipRows if manually configured, otherwise auto-detect
      const headerRowIndex = skipRows > 0 ? skipRows : detectHeaderRow(rawRows);
      const headers = (rawRows[headerRowIndex] || []).map((h: any, i: number) => 
        normalizeHeader(h) || `Col ${i}`
      );
      const dataRows = rawRows.slice(headerRowIndex + 1);

      setSampleFile(file);
      setDetectedColumns(headers);
      
      const preview = dataRows.slice(0, 5).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => obj[h] = (row as any)[i]);
        return obj;
      });
      setPreviewData(preview);

      if (headerRowIndex > 0) {
        toast.success(`En-têtes détectés à la ligne ${headerRowIndex + 1} - ${headers.length} colonnes`, {
          description: "Les en-têtes ont été détectés automatiquement."
        });
      } else {
        toast.success(`${headers.length} colonnes détectées`);
      }

      console.log(`[SupplierMappingSetup] Headers detected at row ${headerRowIndex + 1}:`, headers);
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
        .update({ 
          column_mapping: mapping,
          skip_rows: skipRows 
        })
        .eq('id', supplierId);

      if (error) throw error;

      toast.success("✅ Mapping et configuration sauvegardés");
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
            Téléversez un fichier exemple ou chargez le dernier fichier reçu pour détecter les colonnes.
          </AlertDescription>
        </Alert>

        {/* Bouton pour charger le dernier fichier reçu */}
        <div className="flex justify-center">
          <Button 
            onClick={loadLastReceivedFile} 
            variant="outline" 
            disabled={isLoading || detectedColumns.length > 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Charger le dernier fichier reçu
          </Button>
        </div>

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

            {/* Skip rows configuration */}
            <div className="space-y-2">
              <Label htmlFor="skip-rows">
                ⚙️ Lignes à ignorer avant les en-têtes (optionnel)
              </Label>
              <Input
                id="skip-rows"
                type="number"
                min="0"
                max="50"
                value={skipRows}
                onChange={async (e) => {
                  const newSkipRows = parseInt(e.target.value) || 0;
                  setSkipRows(newSkipRows);
                  
                  // Re-parse file with new skip_rows
                  if (sampleFile) {
                    try {
                      const arrayBuffer = await sampleFile.arrayBuffer();
                      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                      const sheet = workbook.Sheets[workbook.SheetNames[0]];
                      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                      
                      const headerRowIndex = newSkipRows > 0 ? newSkipRows : detectHeaderRow(rawRows);
                      const headers = (rawRows[headerRowIndex] || []).map((h: any, i: number) => 
                        normalizeHeader(h) || `Col ${i}`
                      );
                      const dataRows = rawRows.slice(headerRowIndex + 1);
                      
                      setDetectedColumns(headers);
                      const preview = dataRows.slice(0, 5).map(row => {
                        const obj: any = {};
                        headers.forEach((h: string, i: number) => obj[h] = (row as any)[i]);
                        return obj;
                      });
                      setPreviewData(preview);
                      
                      toast.info(`En-têtes recalculés à la ligne ${headerRowIndex + 1}`);
                    } catch (error) {
                      console.error('Error reparsing:', error);
                    }
                  }
                }}
                placeholder="0 = détection automatique"
              />
              <p className="text-xs text-muted-foreground">
                Nombre de lignes à ignorer avant les vrais en-têtes (titres, légendes, lignes vides).
                <br />
                <strong>0 = détection automatique</strong> (recommandé)
              </p>
            </div>

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
