import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileCheck, AlertCircle } from "lucide-react";
import Papa from "papaparse";

interface QuickImportZoneProps {
  onImportComplete: () => void;
}

export function QuickImportZone({ onImportComplete }: QuickImportZoneProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    total: number;
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const processCSV = async (csvFile: File) => {
    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await csvFile.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const csvData = results.data;
          
          if (!csvData || csvData.length === 0) {
            toast.error("Le fichier CSV est vide");
            setIsImporting(false);
            return;
          }

          if (csvData.length > 5000) {
            toast.error(`Fichier trop volumineux : ${csvData.length} lignes. Maximum autorisé : 5000 lignes. Divisez votre fichier en plusieurs parties.`);
            setIsImporting(false);
            return;
          }

          setImportProgress({ current: 0, total: csvData.length });
          toast.info(`Import de ${csvData.length} lignes en cours...`);

          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
              toast.error("Session expirée. Veuillez vous reconnecter.");
              setIsImporting(false);
              return;
            }

            const { data, error } = await supabase.functions.invoke('import-code2asin-csv', {
              body: { 
                csvData,
                options: {
                  createMissing: false,
                  filename: csvFile.name
                }
              },
            });

            if (error) throw error;

            // Vérifier que results existe
            if (!data || !data.results) {
              throw new Error('Format de réponse invalide: résultats manquants');
            }

            const result = data.results;
            setImportResult({
              success: result.success,
              failed: result.failed,
              total: result.total
            });

            toast.success(`Import terminé : ${result.success}/${result.total} produits enrichis`);
            onImportComplete();
          } catch (error: any) {
            console.error('Import error:', error);
            
            if (error.message?.includes('timeout') || error.message?.includes('Failed to send')) {
              toast.error("⏱️ Timeout : le fichier est trop volumineux. Divisez-le en fichiers de maximum 5000 lignes.");
            } else if (error.message?.includes('500')) {
              toast.error("🔧 Erreur serveur. Réessayez dans quelques instants ou contactez le support.");
            } else {
              toast.error(error.message || "Erreur lors de l'import");
            }
          } finally {
            setIsImporting(false);
            setImportProgress(null);
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          toast.error("Erreur lors de la lecture du fichier CSV");
          setIsImporting(false);
        }
      });
    } catch (error) {
      console.error('File reading error:', error);
      toast.error("Erreur lors de la lecture du fichier");
      setIsImporting(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];
    if (csvFile) {
      setFile(csvFile);
      processCSV(csvFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    disabled: isImporting
  });

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
          ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`rounded-full p-4 ${isDragActive ? 'bg-primary/10' : 'bg-muted'}`}>
            <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm font-medium">Import en cours...</p>
              {importProgress && (
                <p className="text-xs text-muted-foreground">
                  Traitement des {importProgress.total} lignes en cours
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Veuillez patienter, cela peut prendre quelques instants
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {isDragActive 
                  ? "Déposez le fichier ici" 
                  : "Glissez-déposez votre fichier CSV ici"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour sélectionner un fichier
              </p>
              <Button variant="outline" size="sm" disabled={isImporting}>
                Parcourir
              </Button>
            </>
          )}
        </div>
      </div>

      {/* File Info */}
      {file && (
        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <FileCheck className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Fichier sélectionné :</strong> {file.name} ({(file.size / 1024).toFixed(2)} Ko)
          </AlertDescription>
        </Alert>
      )}

      {/* Import Result */}
      {importResult && (
        <Alert className={
          importResult.failed === 0 
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
        }>
          <AlertCircle className={`h-4 w-4 ${importResult.failed === 0 ? 'text-green-600' : 'text-orange-600'}`} />
          <AlertDescription className={importResult.failed === 0 ? 'text-green-900 dark:text-green-100' : 'text-orange-900 dark:text-orange-100'}>
            <strong>Résultat de l'import :</strong>
            <div className="mt-2 space-y-1">
              <div>✅ {importResult.success} produits enrichis avec succès</div>
              {importResult.failed > 0 && (
                <div>❌ {importResult.failed} produits en échec</div>
              )}
              <div className="text-sm mt-2">
                Total : {importResult.total} lignes traitées
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <Alert>
        <AlertDescription>
          <strong>💡 Instructions :</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Exportez vos EAN via la page "Export Code2ASIN"</li>
            <li>Uploadez le fichier sur code2asin.com pour enrichissement</li>
            <li>Téléchargez le fichier enrichi depuis Code2ASIN</li>
            <li>Importez-le ici pour mettre à jour votre base de données</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
