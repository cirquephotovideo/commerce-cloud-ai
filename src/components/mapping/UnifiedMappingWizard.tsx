import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Copy, CheckCircle, Loader2 } from "lucide-react";
import { RawFilePreview } from "./RawFilePreview";
import { RowFilterConfig } from "./RowFilterConfig";
import { ColumnSelector } from "./ColumnSelector";
import { SupplierColumnMapper } from "../SupplierColumnMapper";
import * as XLSX from "xlsx";
import { detectHeaderRow } from "@/lib/detectHeaderRow";

interface UnifiedMappingWizardProps {
  supplierId: string;
  sourceType: 'email' | 'ftp' | 'file' | 'api';
  fileData?: File | ArrayBuffer;
  onSave?: (profile: {
    column_mapping: Record<string, number | null>;
    skip_config: { skip_rows_top: number; skip_rows_bottom: number; skip_patterns: string[] };
    excluded_columns: string[];
  }) => void;
}

export function UnifiedMappingWizard({
  supplierId,
  sourceType,
  fileData,
  onSave
}: UnifiedMappingWizardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Raw file data
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [detectedHeaderRowIndex, setDetectedHeaderRowIndex] = useState(0);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  
  // Step 2: Row filtering
  const [skipRowsTop, setSkipRowsTop] = useState(0);
  const [skipRowsBottom, setSkipRowsBottom] = useState(0);
  const [skipPatterns, setSkipPatterns] = useState<string[]>([]);
  
  // Step 3: Column exclusion
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  
  // Step 4: Mapping
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  
  // Profile
  const [profileName, setProfileName] = useState("");

  // Load existing profile and file
  useEffect(() => {
    loadProfileAndFile();
  }, [supplierId]);

  const loadProfileAndFile = async () => {
    try {
      setLoading(true);
      
      // Load existing profile
      const { data: profile } = await supabase
        .from('supplier_mapping_profiles')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_default', true)
        .single();

      if (profile) {
        setProfileName(profile.profile_name);
        const skipConfig = profile.skip_config as any;
        setSkipRowsTop(skipConfig?.skip_rows_top || 0);
        setSkipRowsBottom(skipConfig?.skip_rows_bottom || 0);
        setSkipPatterns(skipConfig?.skip_patterns || []);
        setExcludedColumns(profile.excluded_columns || []);
        setMapping((profile.column_mapping as any) || {});
      }

      // Load last file for preview
      if (!fileData) {
        const { data: lastEmail } = await supabase
          .from('email_inbox')
          .select('attachment_url, attachment_name')
          .eq('supplier_id', supplierId)
          .order('received_at', { ascending: false })
          .limit(1)
          .single();

        if (lastEmail?.attachment_url) {
          const { data: fileBlob } = await supabase.storage
            .from('email-attachments')
            .download(lastEmail.attachment_url.replace('email-attachments/', ''));
          
          if (fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            await parseFile(arrayBuffer);
          }
        }
      } else {
        await parseFile(fileData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le profil de mapping",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const parseFile = async (data: File | ArrayBuffer) => {
    try {
      let arrayBuffer: ArrayBuffer;
      
      if (data instanceof ArrayBuffer) {
        arrayBuffer = data;
      } else if (data instanceof File) {
        arrayBuffer = await data.arrayBuffer();
      } else {
        throw new Error("Unsupported file type");
      }
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      setRawRows(allRows);
      
      // Detect header row
      const headerRowIdx = detectHeaderRow(allRows);
      setDetectedHeaderRowIndex(headerRowIdx);
      
      const headers = allRows[headerRowIdx]?.map(h => String(h || '').trim()) || [];
      setDetectedColumns(headers);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier",
        variant: "destructive"
      });
    }
  };

  // Calculate filtered rows
  const getFilteredRows = () => {
    let filtered = [...rawRows];
    
    // Remove header row and rows before it
    filtered = filtered.slice(detectedHeaderRowIndex + 1);
    
    // Skip top rows
    if (skipRowsTop > 0) {
      filtered = filtered.slice(skipRowsTop);
    }
    
    // Skip bottom rows
    if (skipRowsBottom > 0) {
      filtered = filtered.slice(0, -skipRowsBottom);
    }
    
    // Apply patterns
    if (skipPatterns.length > 0) {
      filtered = filtered.filter(row => {
        const rowStr = row.join(' ').toLowerCase();
        return !skipPatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
          return regex.test(rowStr);
        });
      });
    }
    
    return filtered;
  };

  const ignoredRowsCount = rawRows.length - detectedHeaderRowIndex - 1 - getFilteredRows().length;

  // Get included columns for mapping
  const includedColumns = detectedColumns.filter(col => !excludedColumns.includes(col));

  // Prepare preview data for SupplierColumnMapper
  const getPreviewDataForMapper = () => {
    const filteredRows = getFilteredRows();
    const includedIndices = detectedColumns
      .map((col, idx) => !excludedColumns.includes(col) ? idx : -1)
      .filter(idx => idx !== -1);
    
    return filteredRows.slice(0, 10).map(row => {
      const obj: any = {};
      includedColumns.forEach((col, i) => {
        obj[col] = row[includedIndices[i]];
      });
      return obj;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!profileName.trim()) {
        toast({
          title: "Nom requis",
          description: "Veuillez entrer un nom pour ce profil",
          variant: "destructive"
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Prepare profile data
      const profileData = {
        user_id: user.id,
        supplier_id: supplierId,
        profile_name: profileName,
        source_type: sourceType,
        skip_config: {
          skip_rows_top: skipRowsTop,
          skip_rows_bottom: skipRowsBottom,
          skip_patterns: skipPatterns
        },
        excluded_columns: excludedColumns,
        column_mapping: mapping,
        is_default: true
      };

      // Check if profile exists
      const { data: existing } = await supabase
        .from('supplier_mapping_profiles')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('is_default', true)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('supplier_mapping_profiles')
          .update(profileData)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('supplier_mapping_profiles')
          .insert(profileData);
        
        if (error) throw error;
      }

      toast({
        title: "✅ Profil sauvegardé",
        description: `Le profil "${profileName}" a été enregistré avec succès`
      });

      onSave?.({
        column_mapping: mapping,
        skip_config: {
          skip_rows_top: skipRowsTop,
          skip_rows_bottom: skipRowsBottom,
          skip_patterns: skipPatterns
        },
        excluded_columns: excludedColumns
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const validMapping = mapping.product_name !== null && 
                      mapping.purchase_price !== null && 
                      (mapping.ean !== null || mapping.supplier_reference !== null);
  const previewData = getPreviewDataForMapper();
  
  // Suggest profile name if empty
  const suggestedProfileName = profileName || `Profil ${new Date().toLocaleDateString('fr-FR')}`;

  return (
    <div className="space-y-6">
      {/* Step 1: Raw File Preview */}
      {rawRows.length > 0 && (
        <RawFilePreview
          rawRows={rawRows}
          detectedHeaderRow={detectedHeaderRowIndex}
          onHeaderRowChange={setDetectedHeaderRowIndex}
        />
      )}

      {/* Step 2: Row Filtering */}
      {detectedColumns.length > 0 && (
        <RowFilterConfig
          skipRowsTop={skipRowsTop}
          skipRowsBottom={skipRowsBottom}
          skipPatterns={skipPatterns}
          totalRows={rawRows.length - detectedHeaderRowIndex - 1}
          ignoredRowsCount={ignoredRowsCount}
          onSkipRowsTopChange={setSkipRowsTop}
          onSkipRowsBottomChange={setSkipRowsBottom}
          onSkipPatternsChange={setSkipPatterns}
        />
      )}

      {/* Step 3: Column Selection */}
      {detectedColumns.length > 0 && (
        <ColumnSelector
          detectedColumns={detectedColumns}
          excludedColumns={excludedColumns}
          onExcludedColumnsChange={setExcludedColumns}
        />
      )}

      {/* Step 4: Intelligent Mapping */}
      {includedColumns.length > 0 && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔗 Étape 4 : Mapping intelligent
            </CardTitle>
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

      {/* Save Profile */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle>💾 Sauvegarder le profil fournisseur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="profile-name">Nom du profil</Label>
            <Input 
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={suggestedProfileName}
            />
          </div>
          
          {!validMapping && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>⚠️ Champs manquants :</strong>
                <ul className="text-xs mt-2 space-y-1">
                  {!mapping.product_name && <li>• Nom du produit</li>}
                  {!mapping.purchase_price && <li>• Prix d'achat</li>}
                  {(!mapping.ean && !mapping.supplier_reference) && <li>• EAN ou Référence fournisseur</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {validMapping && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ Profil valide</strong>
                <ul className="text-xs mt-2 space-y-1">
                  <li>• {ignoredRowsCount} lignes ignorées</li>
                  <li>• {excludedColumns.length} colonnes cachées</li>
                  <li>• {Object.keys(mapping).filter(k => mapping[k] !== null).length} champs mappés</li>
                  <li>• {getFilteredRows().length} lignes de données valides</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSave} 
              disabled={!validMapping || saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder et utiliser
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
