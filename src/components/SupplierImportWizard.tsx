import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, ArrowLeft, ArrowRight, Save, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SupplierColumnMapper } from "./SupplierColumnMapper";
import { CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { detectHeaderRow } from "@/lib/detectHeaderRow";
import { RawFilePreview } from "./mapping/RawFilePreview";
import { RowFilterConfig } from "./mapping/RowFilterConfig";
import { ColumnSelector } from "./mapping/ColumnSelector";

interface SupplierImportWizardProps {
  onClose: () => void;
}

export function SupplierImportWizard({ onClose }: SupplierImportWizardProps) {
  const queryClient = useQueryClient();
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
  const [linkingStats, setLinkingStats] = useState<{
    linked: number;
    unlinked: number;
  } | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // Unified mapper states
  const [skipRowsTop, setSkipRowsTop] = useState(0);
  const [skipRowsBottom, setSkipRowsBottom] = useState(0);
  const [skipPatterns, setSkipPatterns] = useState<string[]>([]);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [detectedHeaderRow, setDetectedHeaderRow] = useState(0);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);

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
      const { data, error } = await supabase
        .from("mapping_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("template_name");
      if (error) {
        console.error('[WIZARD] Error loading templates:', error);
        return [];
      }
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
      
      // Validate file size (500 MB max, 200 MB warning)
      const warningSize = 200 * 1024 * 1024; // 200 MB
      const maxSize = 500 * 1024 * 1024; // 500 MB
      
      if (selectedFile.size > maxSize) {
        toast.error(
          `❌ Fichier trop volumineux (${(selectedFile.size / 1024 / 1024).toFixed(0)} MB). ` +
          `Maximum : 500 MB. Veuillez diviser votre fichier en plusieurs parties.`
        );
        return;
      }
      
      if (selectedFile.size > warningSize) {
        toast.warning(
          `⚠️ Fichier volumineux détecté (${(selectedFile.size / 1024 / 1024).toFixed(0)} MB). ` +
          `Le traitement peut prendre plusieurs minutes.`
        );
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
      
      // Store all raw rows for unified mapper
      setRawRows(jsonData);
      
      // Detect header row and check if file has headers
      const headerRowIdx = detectHeaderRow(jsonData);
      const firstRow = jsonData[0] || [];
      
      // Smart detection: if first row looks like typical column names, it's a header
      const hasTypicalHeaders = firstRow.some((cell: any) => {
        const str = String(cell || '').toLowerCase().trim();
        return ['nom', 'name', 'référence', 'ref', 'prix', 'price', 'ean', 'code', 'description', 'stock', 'quantité', 'quantity'].includes(str);
      });
      const likelyNoHeader = !hasTypicalHeaders;
      
      setDetectedHeaderRow(likelyNoHeader ? -1 : headerRowIdx);
      setHasHeaderRow(!likelyNoHeader);
      // Force skipRows=0 when there's no header to prevent accidental row skipping
      setSkipRows(likelyNoHeader ? 0 : 1);
      
      console.log('[WIZARD] File analysis:', {
        totalRows: jsonData.length,
        firstRowValues: firstRow,
        hasTypicalHeaders,
        likelyNoHeader,
        detectedHeaderRow: likelyNoHeader ? -1 : headerRowIdx,
        skipRowsWillBe: likelyNoHeader ? 0 : 1
      });
      
      // Show first 10 rows including headers for preview
      setPreview(jsonData.slice(0, 10));
    } else {
      const text = await file.text();
      const allLines = text.split("\n");
      const parsed = allLines.map(line => line.split(delimiter));
      
      // Store all raw rows for unified mapper
      setRawRows(parsed);
      
      // Detect header row and check if file has headers
      const headerRowIdx = detectHeaderRow(parsed);
      const firstRow = parsed[0] || [];
      
      // Smart detection: if first row looks like typical column names, it's a header
      const hasTypicalHeaders = firstRow.some((cell: any) => {
        const str = String(cell || '').toLowerCase().trim();
        return ['nom', 'name', 'référence', 'ref', 'prix', 'price', 'ean', 'code', 'description', 'stock', 'quantité', 'quantity'].includes(str);
      });
      const likelyNoHeader = !hasTypicalHeaders;
      
      setDetectedHeaderRow(likelyNoHeader ? -1 : headerRowIdx);
      setHasHeaderRow(!likelyNoHeader);
      setSkipRows(likelyNoHeader ? 0 : 1);
      
      console.log('[WIZARD] File analysis:', {
        totalRows: parsed.length,
        firstRowValues: firstRow,
        hasTypicalHeaders,
        likelyNoHeader,
        detectedHeaderRow: likelyNoHeader ? -1 : headerRowIdx,
        skipRowsWillBe: likelyNoHeader ? 0 : 1
      });
      
      // Show first 10 rows including headers for preview
      const lines = allLines.slice(0, 10);
      const previewParsed = lines.map(line => line.split(delimiter));
      setPreview(previewParsed);
    }
  };

  // Utility functions for unified mapper
  const calculateIgnoredRows = () => {
    let count = skipRowsTop + skipRowsBottom;
    
    if (skipPatterns.length > 0) {
      const dataRows = rawRows.slice(detectedHeaderRow + 1);
      const patternMatches = dataRows.filter(row => {
        const rowStr = row.join(' ').toLowerCase();
        return skipPatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
          return regex.test(rowStr);
        });
      });
      count += patternMatches.length;
    }
    
    return count;
  };

  const getDetectedColumns = () => {
    const headerRow = rawRows[detectedHeaderRow] || [];
    return headerRow.map(h => String(h || '').trim());
  };

  const getFilteredPreviewData = () => {
    // Apply skip_config and excluded_columns
    let filteredRows = rawRows.slice(detectedHeaderRow + 1);
    
    // Skip top/bottom
    if (skipRowsTop > 0) filteredRows = filteredRows.slice(skipRowsTop);
    if (skipRowsBottom > 0) filteredRows = filteredRows.slice(0, -skipRowsBottom);
    
    // Skip patterns
    if (skipPatterns.length > 0) {
      filteredRows = filteredRows.filter(row => {
        const rowStr = row.join(' ').toLowerCase();
        return !skipPatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
          return regex.test(rowStr);
        });
      });
    }
    
    // Filter excluded columns
    const headers = getDetectedColumns();
    const includedIndices = headers
      .map((h, idx) => !excludedColumns.includes(h) ? idx : -1)
      .filter(idx => idx !== -1);
    
    return filteredRows.slice(0, 10).map(row => {
      const obj: any = {};
      headers.forEach((h, i) => {
        if (!excludedColumns.includes(h)) {
          obj[h] = row[i];
        }
      });
      return obj;
    });
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

    // Log mapping for debugging
    console.log('[IMPORT] Column mapping:', {
      product_name: columnMapping.product_name,
      purchase_price: columnMapping.purchase_price,
      ean: columnMapping.ean,
      supplier_reference: columnMapping.supplier_reference,
      description: columnMapping.description,
      stock_quantity: columnMapping.stock_quantity
    });

    setLoading(true);
    setImportProgress({ current: 0, total: 100, status: 'processing', message: 'Préparation de l\'import...' });
    
    try {
      const isXLSX = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save unified mapping profile
      await supabase
        .from('supplier_mapping_profiles')
        .upsert({
          user_id: user.id,
          supplier_id: supplierId,
          profile_name: `Import ${new Date().toLocaleDateString()}`,
          source_type: 'file',
          skip_config: {
            skip_rows_top: skipRowsTop,
            skip_rows_bottom: skipRowsBottom,
            skip_patterns: skipPatterns
          },
          excluded_columns: excludedColumns,
          column_mapping: columnMapping,
          is_default: true
        }, {
          onConflict: 'supplier_id,is_default'
        });
      
      // Save column mapping to supplier configuration
      await supabase
        .from('supplier_configurations')
        .update({ column_mapping: columnMapping })
        .eq('id', supplierId);
      
      setImportProgress({ current: 5, total: 100, status: 'processing', message: 'Lecture du fichier...' });
      
      // Parse file client-side for XLSX
      if (isXLSX) {
        console.log('[WIZARD] Parsing XLSX file client-side...');
        
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        // Apply skip rows
        const dataRows = skipRowsTop > 0 ? rawData.slice(skipRowsTop) : rawData;
        const totalRows = dataRows.length;
        
        console.log('[WIZARD] Parsed', totalRows, 'rows');
        
        setImportProgress({ current: 10, total: 100, status: 'processing', message: 'Upload du fichier...' });
        
        // Upload file to storage for record keeping
        const timestamp = Date.now();
        const filePath = `${user.id}/${timestamp}_${file.name}`;
        
        await supabase.storage
          .from('supplier-imports')
          .upload(filePath, file, { upsert: false });
        
        setImportProgress({ current: 15, total: 100, status: 'processing', message: 'Création du job d\'import...' });
        
        // Create import job
        const { data: job, error: jobError } = await supabase
          .from('supplier_import_chunk_jobs')
          .insert({
            user_id: user.id,
            supplier_id: supplierId,
            file_path: filePath,
            total_rows: totalRows,
            processed_rows: 0,
            current_chunk: 0,
            chunk_size: 100,
            skip_rows: skipRowsTop,
            column_mapping: columnMapping,
            status: 'processing',
            matched: 0,
            new_products: 0,
            failed: 0,
          })
          .select()
          .single();

        if (jobError || !job) {
          throw new Error('Échec de la création du job d\'import');
        }

        console.log('[WIZARD] Job created:', job.id);
        
        // Send chunks
        const chunkSize = 100;
        const totalChunks = Math.ceil(totalRows / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, totalRows);
          const chunkData = dataRows.slice(start, end);
          
          const progressPct = Math.round(15 + (85 * (i + 1) / totalChunks));
          setImportProgress({
            current: end,
            total: totalRows,
            status: 'processing',
            message: `Import: ${end}/${totalRows} lignes (chunk ${i + 1}/${totalChunks})`,
          });

          // Get fresh session for auth
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Session expirée, veuillez vous reconnecter');
          }

          const { data: chunkResult, error: chunkError } = await supabase.functions.invoke('supplier-import-data-chunk', {
            body: {
              jobId: job.id,
              chunkIndex: i,
              chunkData,
              columnMapping,
              supplierId,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (chunkError) {
            console.error('[WIZARD] Chunk error:', chunkError);
            throw chunkError;
          }

          console.log('[WIZARD] Chunk', i + 1, '/', totalChunks, 'processed');

          if (chunkResult?.isComplete) {
            setImportProgress({
              current: totalRows,
              total: totalRows,
              status: 'complete',
              message: `Terminé: ${chunkResult.stats.new} nouveaux, ${chunkResult.stats.matched} mises à jour`,
            });
            toast.success(`Import réussi: ${chunkResult.stats.new} nouveaux produits, ${chunkResult.stats.matched} mises à jour`);
            
            // Fetch linking stats from job
            setCurrentJobId(job.id);
            setTimeout(async () => {
              const { data: jobData } = await supabase
                .from('supplier_import_chunk_jobs')
                .select('links_created, unlinked_products')
                .eq('id', job.id)
                .single();
              
              if (jobData) {
                setLinkingStats({
                  linked: jobData.links_created || 0,
                  unlinked: jobData.unlinked_products || 0,
                });
              }
            }, 2000); // Wait 2s for auto-link to complete
            
            break;
          }
        }
      } else {
        // For CSV, use direct import
        setImportProgress({ current: 10, total: 100, status: 'processing', message: 'Upload du fichier...' });
        
        const timestamp = Date.now();
        const filePath = `${user.id}/${timestamp}_${file.name}`;
        
        await supabase.storage
          .from('supplier-imports')
          .upload(filePath, file, { upsert: false });
        
        setImportProgress({ current: 40, total: 100, status: 'processing', message: 'Traitement en cours...' });

        const { data, error } = await supabase.functions.invoke('supplier-import-csv', {
          body: {
            supplierId,
            filePath,
            columnMapping,
            skipRows,
            delimiter: delimiter || ',',
            hasHeaderRow,
          },
        });

        if (error) {
          throw new Error(`Erreur lors de l'importation: ${error.message}`);
        }
        
        console.log('[WIZARD] CSV Import response:', data);
        toast.success('✅ Import CSV démarré en arrière-plan');
        setImportProgress({
          current: 80,
          total: 100,
          status: 'processing',
          message: 'Traitement du CSV en cours...'
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      
    } catch (error) {
      console.error('[WIZARD] Import error:', error);
      setImportProgress({ 
        current: 0, 
        total: 0, 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Erreur inconnue' 
      });
      toast.error(`Erreur d'import: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template?.mapping_config) {
      setColumnMapping(template.mapping_config as Record<string, number | null>);
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
      
      const { error } = await supabase
        .from("mapping_templates")
        .insert({
          user_id: user.id,
          template_name: templateName,
          description: templateDescription,
          mapping_config: columnMapping,
          is_default: false,
        });
      
      if (error) throw error;
      
      toast.success("Template sauvegardé avec succès");
      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateDescription("");
      
      // Recharger la liste des templates
      queryClient.invalidateQueries({ queryKey: ["mapping-templates"] });
    } catch (error: any) {
      console.error('[WIZARD] Error saving template:', error);
      toast.error("Erreur lors de la sauvegarde : " + error.message);
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

          {/* Step 2: Raw File Preview */}
          {step === 2 && rawRows.length > 0 && (
            <RawFilePreview
              rawRows={rawRows}
              detectedHeaderRow={detectedHeaderRow}
              onHeaderRowChange={setDetectedHeaderRow}
            />
          )}

          {/* Step 3: Unified Mapping Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Header Row Detection Card */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Détection de l'en-tête
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview of first row */}
                  <div className="p-3 bg-muted/30 rounded-lg border">
                    <div className="text-sm font-medium mb-2">📄 Aperçu de la ligne 1 :</div>
                    <div className="text-xs font-mono overflow-x-auto">
                      {rawRows[0]?.slice(0, 5).map((cell, idx) => (
                        <span key={idx} className="mr-4">
                          [{idx + 1}]: <span className="text-primary">{String(cell || '(vide)').substring(0, 30)}</span>
                        </span>
                      ))}
                      {rawRows[0]?.length > 5 && <span className="text-muted-foreground">... ({rawRows[0].length - 5} autres colonnes)</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor="has-header" className="text-base font-medium">
                        Mon fichier a une ligne d'en-tête
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {hasHeaderRow 
                          ? "✓ La ligne 1 contient les noms de colonnes (Référence, Nom, Prix...)" 
                          : "✗ La ligne 1 contient déjà des données produit"}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="has-header"
                        type="checkbox"
                        checked={hasHeaderRow}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setHasHeaderRow(newValue);
                          setSkipRows(newValue ? 1 : 0);
                          setDetectedHeaderRow(newValue ? 0 : -1);
                          console.log('[WIZARD] Header toggle changed:', { hasHeaderRow: newValue, skipRows: newValue ? 1 : 0 });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <Alert className={hasHeaderRow ? "" : "border-amber-500/50 bg-amber-500/10"}>
                    <AlertDescription className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>
                          <strong>Lignes totales:</strong> {rawRows.length}
                        </span>
                        <span>
                          <strong>Lignes à traiter:</strong> {Math.max(0, rawRows.length - (hasHeaderRow ? 1 : 0))} produits
                        </span>
                      </div>
                      <div className="text-sm">
                        {hasHeaderRow ? (
                          <span className="text-green-600">✓ Ligne 1 = En-tête, Lignes 2-{rawRows.length} = Données</span>
                        ) : (
                          <span className="text-amber-600">⚠️ Ligne 1 = DONNÉES (pas d'en-tête détecté), Lignes 1-{rawRows.length} = Toutes les données</span>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  {!hasHeaderRow && (
                    <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                      <AlertDescription>
                        ⚠️ Sans en-tête, assurez-vous que le mapping correspond exactement à l'ordre des colonnes dans votre fichier.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              
              {/* Row Filtering */}
              <RowFilterConfig
                skipRowsTop={skipRowsTop}
                skipRowsBottom={skipRowsBottom}
                skipPatterns={skipPatterns}
                totalRows={rawRows.length - detectedHeaderRow - 1}
                ignoredRowsCount={calculateIgnoredRows()}
                onSkipRowsTopChange={setSkipRowsTop}
                onSkipRowsBottomChange={setSkipRowsBottom}
                onSkipPatternsChange={setSkipPatterns}
              />
              
              {/* Column Selection */}
              <ColumnSelector
                detectedColumns={getDetectedColumns()}
                excludedColumns={excludedColumns}
                onExcludedColumnsChange={setExcludedColumns}
              />
              
              {/* Column Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>🔗 Configuration du mapping</CardTitle>
                </CardHeader>
                <CardContent>
                  <SupplierColumnMapper
                    previewData={getFilteredPreviewData()}
                    onMappingChange={setColumnMapping}
                    initialMapping={columnMapping}
                  />
                </CardContent>
              </Card>
              
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
                                {t.description && (
                                  <span className="text-xs text-muted-foreground">
                                    - {t.description}
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
            <>
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {importProgress.message}
                </AlertDescription>
              </Alert>

              {linkingStats && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Produits liés</div>
                      <div className="text-2xl font-bold text-green-600">
                        {linkingStats.linked}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Associés automatiquement au catalogue
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className={linkingStats.unlinked > 0 ? "border-orange-200 bg-orange-50 dark:bg-orange-950" : "border-gray-200"}>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Produits non liés</div>
                      <div className={`text-2xl font-bold ${linkingStats.unlinked > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        {linkingStats.unlinked}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {linkingStats.unlinked > 0 ? 'Nécessitent une liaison manuelle' : 'Tous les produits sont liés'}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {linkingStats && linkingStats.unlinked > 0 && (
                <Alert className="mt-4 border-orange-200 bg-orange-50 dark:bg-orange-950">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    {linkingStats.unlinked} produits n'ont pas pu être liés automatiquement.
                    <Button 
                      variant="link" 
                      className="ml-2 p-0 h-auto text-orange-600 hover:text-orange-700"
                      onClick={() => {
                        onClose();
                        window.location.href = '/suppliers';
                      }}
                    >
                      Voir les produits fournisseurs →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </>
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
