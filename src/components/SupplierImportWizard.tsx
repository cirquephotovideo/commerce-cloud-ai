import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, ArrowLeft, ArrowRight, Save, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useEffect } from "react";

interface SupplierImportWizardProps {
  onClose: () => void;
}

export function SupplierImportWizard({ onClose }: SupplierImportWizardProps) {
  const [step, setStep] = useState(1);
  const [supplierId, setSupplierId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [delimiter, setDelimiter] = useState(";");
  const [skipRows, setSkipRows] = useState(1);
  const [preview, setPreview] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle' as 'idle' | 'processing' | 'complete' | 'error',
    message: '',
  });

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

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["mapping-templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("supplier_mapping_templates")
        .select("*")
        .order("template_name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing mapping when supplier is selected
  useEffect(() => {
    if (!supplierId) return;
    
    const loadMapping = async () => {
      const { data: supplier } = await supabase
        .from('supplier_configurations')
        .select('column_mapping')
        .eq('id', supplierId)
        .single();
      
      if (supplier?.column_mapping) {
        console.log('[WIZARD] Loaded existing mapping:', supplier.column_mapping);
        setColumnMapping(supplier.column_mapping as Record<string, number | null>);
      }
    };
    
    loadMapping();
  }, [supplierId]);

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
      // Show first 10 rows including headers for preview
      setPreview(jsonData.slice(0, 10));
    } else {
      const text = await file.text();
      const allLines = text.split("\n");
      // Show first 10 rows including headers for preview
      const lines = allLines.slice(0, 10);
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
    setImportProgress({ current: 0, total: 100, status: 'processing', message: 'Préparation de l\'import...' });
    
    try {
      const isXLSX = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      
      // Save column mapping to supplier configuration
      await supabase
        .from('supplier_configurations')
        .update({ column_mapping: columnMapping })
        .eq('id', supplierId);
      
      setImportProgress({ current: 20, total: 100, status: 'processing', message: 'Envoi du fichier...' });
      
      if (isXLSX) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        setImportProgress({ current: 40, total: 100, status: 'processing', message: 'Traitement des produits...' });
        
        const { data, error } = await supabase.functions.invoke("supplier-import-xlsx", {
          body: {
            supplierId,
            fileContent: base64,
            skipRows,
            columnMapping,
          },
        });

        if (error) throw error;
        
        setImportProgress({ current: 100, total: 100, status: 'complete', message: `✅ ${data.imported} produits importés` });
        toast.success(`✅ Import réussi: ${data.imported} produits importés`);
      } else {
        const text = await file.text();
        
        setImportProgress({ current: 40, total: 100, status: 'processing', message: 'Traitement des produits...' });
        
        const { data, error } = await supabase.functions.invoke("supplier-import-csv", {
          body: {
            supplierId,
            fileContent: text,
            delimiter,
            skipRows,
            columnMapping,
          },
        });

        if (error) throw error;
        
        setImportProgress({ current: 100, total: 100, status: 'complete', message: `✅ ${data.imported} produits importés` });
        toast.success(`✅ Import réussi: ${data.imported} produits importés`);
      }
      
      setTimeout(() => onClose(), 1500); // Close after 1.5s
    } catch (error) {
      console.error("Import error:", error);
      setImportProgress({ current: 0, total: 100, status: 'error', message: '❌ Erreur lors de l\'importation' });
      toast.error("❌ Erreur lors de l'importation");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template?.column_mapping) {
      setColumnMapping(template.column_mapping);
      toast.success(`Template "${template.template_name}" chargé`);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) {
      toast.error("Veuillez saisir un nom pour le template");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      
      await (supabase as any)
        .from("supplier_mapping_templates")
        .insert({
          template_name: templateName,
          template_description: templateDescription,
          column_mapping: columnMapping,
        });
      
      toast.success("Template sauvegardé avec succès");
      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateDescription("");
    } catch (error) {
      console.error("Save template error:", error);
      toast.error("Erreur lors de la sauvegarde du template");
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

                <div className="grid grid-cols-2 gap-4">
                  {file?.name.endsWith(".csv") && (
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
                  )}
                  <div>
                    <Label>Nombre de lignes à ignorer</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={skipRows}
                      onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                      placeholder="0 = aucune, 1 = en-têtes..."
                    />
                  </div>
                </div>
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
            <div className="space-y-4">
              {/* Template controls */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">📋 Templates de mapping</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder en tant que template
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Charger un template existant</Label>
                      <Select value={selectedTemplate} onValueChange={(val) => {
                        setSelectedTemplate(val);
                        handleLoadTemplate(val);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4" />
                                {t.template_name}
                                {t.template_description && (
                                  <span className="text-xs text-muted-foreground">
                                    - {t.template_description}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {showSaveTemplate && (
                    <div className="space-y-3 p-4 border rounded-lg bg-background">
                      <div>
                        <Label>Nom du template *</Label>
                        <Input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Ex: Fournisseur standard"
                        />
                      </div>
                      <div>
                        <Label>Description (optionnelle)</Label>
                        <Input
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          placeholder="Ex: Template pour fichiers CSV standards"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveTemplate}
                          disabled={!templateName || !columnMapping}
                        >
                          Sauvegarder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowSaveTemplate(false)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <SupplierColumnMapper
                previewData={preview}
                onMappingChange={setColumnMapping}
                initialMapping={columnMapping}
              />
            </div>
          )}

          {/* Progress Bar */}
          {importProgress.status === 'processing' && (
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{importProgress.message}</span>
                    <span className="text-muted-foreground">{importProgress.current}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${importProgress.current}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {importProgress.status === 'complete' && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {importProgress.message}
              </AlertDescription>
            </Alert>
          )}

          {importProgress.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importProgress.message}</AlertDescription>
            </Alert>
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
