import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileCheck, FileUp, AlertCircle, CheckCircle2, Package } from "lucide-react";
import { ImportedProductsList } from "@/components/code2asin/ImportedProductsList";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { format } from "date-fns";

interface Code2AsinRow {
  ASIN?: string;
  Titre?: string;
  EAN?: string;
  UPC?: string;
  'Numéro de pièce'?: string;
  'Prix Buy Box Nouvelle (€)'?: string;
  'Prix Amazon (€)'?: string;
  "Prix le plus bas FBA en 'Neuf' (€)"?: string;
  Marque?: string;
  Fabricant?: string;
  Images?: string;
  "Longueur de l'article (cm)"?: string;
  "Largeur de l'article (cm)"?: string;
  "Hauteur de l'article (cm)"?: string;
  "Poids de l'article (g)"?: string;
  "Longueur du paquet (cm)"?: string;
  "Largeur du paquet (cm)"?: string;
  "Hauteur du paquet (cm)"?: string;
  "Poids de l'emballage (g)"?: string;
  "Nombre d'offres en 'Neuf'"?: string;
  'Pourcentage de commission de référence'?: string;
  "Frais de préparation et d'emballage (€)"?: string;
  'Rangs de vente'?: string;
  Couleur?: string;
  Taille?: string;
  Fonctionnalités?: string;
  Marché?: string;
  'Groupe de produits'?: string;
  Type?: string;
  'Parcourir les nœuds'?: string;
  "Nom du vendeur dans l'offre Buy Box Nouvelle"?: string;
  "La Buy Box Nouvelle est-elle gérée par Amazon ?"?: string;
  "La Buy Box Nouvelle est-elle d'Amazon ?"?: string;
  "Prix le plus bas en 'Neuf' (€)"?: string;
  "Prix le plus bas en 'D'occasion' (€)"?: string;
  'Prix de liste (€)'?: string;
  [key: string]: string | undefined;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: string[];
}

export default function Code2AsinImport() {
  const [csvData, setCsvData] = useState<Code2AsinRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [lastImportDate, setLastImportDate] = useState<Date | null>(null);
  const [user, setUser] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processedRows, setProcessedRows] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Subscribe to job updates
  useEffect(() => {
    if (!jobId || !user) return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'code2asin_import_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          const job = payload.new as any;
          setProcessedRows(job.processed_rows);
          
          if (job.status === 'completed') {
            setImportResult({
              total: job.total_rows,
              success: job.success_count,
              failed: job.failed_count,
              created: job.created_count,
              updated: job.updated_count,
              errors: job.errors || []
            });
            setImportProgress(100);
            setIsImporting(false);
            setLastImportDate(new Date());
            toast.success(`✅ Import terminé: ${job.success_count} produits enrichis`);
            channel.unsubscribe();
          } else if (job.status === 'failed') {
            toast.error(`Erreur d'import: ${job.error_message}`);
            setIsImporting(false);
            channel.unsubscribe();
          } else if (job.status === 'processing') {
            const progress = Math.round((job.processed_rows / job.total_rows) * 100);
            setImportProgress(progress);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId, user]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRawFile(file);
    setFileName(file.name);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Code2AsinRow[];
        
        // Validate required columns
        if (data.length === 0 || !data[0].EAN) {
          toast.error("Le CSV doit contenir au moins une colonne 'EAN'");
          return;
        }
        
        // Detect duplicates in CSV
        const eanCounts = data.reduce((acc, row) => {
          if (row.EAN) {
            acc[row.EAN] = (acc[row.EAN] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const duplicates = Object.entries(eanCounts)
          .filter(([_, count]) => count > 1)
          .map(([ean]) => ean);

        if (duplicates.length > 0) {
          toast.warning(`⚠️ ${duplicates.length} EAN en doublon détectés dans le CSV. Seul le premier sera importé.`, {
            duration: 5000
          });
        }
        
        setCsvData(data);
        toast.success(`✅ ${data.length} produits chargés depuis le CSV`);
      },
      error: (error) => {
        toast.error(`Erreur de parsing: ${error.message}`);
      }
    });
  };

  const startImport = async () => {
    if (!csvData || !rawFile) return;

    setIsImporting(true);
    setImportProgress(0);
    setProcessedRows(0);
    setImportResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Non authentifié");
      }

      // 1️⃣ Upload du fichier vers Storage
      const timestamp = Date.now();
      const filePath = `code2asin-imports/${user!.id}/${timestamp}_${fileName}`;
      
      toast.info('📤 Upload du fichier en cours...');
      console.log(`Uploading CSV to storage: ${filePath}`);
      
      const { error: uploadError } = await supabase.storage
        .from('supplier-imports')
        .upload(filePath, rawFile, {
          contentType: 'text/csv',
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Échec de l'upload: ${uploadError.message}`);
      }
      
      toast.success('✅ Fichier uploadé, démarrage du traitement...');

      // 2️⃣ Appeler l'edge function avec seulement le filePath
      const response = await supabase.functions.invoke('import-code2asin-csv', {
        body: {
          filePath,
          options: {
            overwrite: overwriteExisting,
            createMissing,
            filename: fileName
          }
        }
      });

      if (response.error) throw response.error;

      if (!response.data || !response.data.started) {
        throw new Error('Format de réponse invalide');
      }

      setJobId(response.data.job_id);
      toast.success(`🚀 Import démarré en arrière-plan (${response.data.total_rows} produits)`);

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur d'import: ${error.message}`);
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-6 w-6" />
            📥 Import CSV Code2ASIN
          </CardTitle>
          <CardDescription>
            Importez les données enrichies depuis code2asin.com pour compléter vos analyses produits
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Zone d'upload */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Glissez votre CSV ici ou cliquez pour sélectionner
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="outline" asChild>
                <span>Sélectionner un fichier CSV</span>
              </Button>
            </label>
            {fileName && (
              <p className="text-sm text-muted-foreground mt-2">
                Fichier: <strong>{fileName}</strong>
              </p>
            )}
          </div>
          
          {/* Prévisualisation */}
          {csvData && (
            <>
              <Alert>
                <FileCheck className="h-4 w-4" />
                <AlertDescription>
                  <strong>{csvData.length}</strong> produits détectés dans le CSV
                </AlertDescription>
              </Alert>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>EAN</TableHead>
                        <TableHead>ASIN</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Prix Buy Box</TableHead>
                        <TableHead>Marque</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{row.EAN}</TableCell>
                          <TableCell className="font-mono text-xs">{row.ASIN}</TableCell>
                          <TableCell className="max-w-xs truncate">{row.Titre}</TableCell>
                          <TableCell>{row['Prix Buy Box Nouvelle (€)']}€</TableCell>
                          <TableCell>{row.Marque}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {csvData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    ... et {csvData.length - 10} autres produits
                  </div>
                )}
              </div>
              
              {/* Options d'import */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="overwrite"
                    checked={overwriteExisting}
                    onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
                  />
                  <label htmlFor="overwrite" className="text-sm font-medium cursor-pointer">
                    Écraser les enrichissements existants
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="create-missing"
                    checked={createMissing}
                    onCheckedChange={(checked) => setCreateMissing(checked as boolean)}
                  />
                  <label htmlFor="create-missing" className="text-sm font-medium cursor-pointer">
                    Créer des analyses pour les EAN non trouvés
                  </label>
                </div>
              </div>
              
              {/* Bouton d'import */}
              <Button
                onClick={startImport}
                disabled={!csvData || isImporting}
                className="w-full"
                size="lg"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    Lancer l'import ({csvData.length} produits)
                  </>
                )}
              </Button>
              
              {/* Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {processedRows > 0 ? (
                      <>Traitement: {processedRows} / {csvData.length} produits</>
                    ) : (
                      <>Démarrage de l'import...</>
                    )}
                  </p>
                  {processedRows > 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      {Math.round(importProgress)}% terminé
                    </p>
                  )}
                </div>
              )}
              
              {/* Résumé d'import */}
              {importResult && (
                <Card className={`border-2 ${importResult.failed === 0 ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {importResult.failed === 0 ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-green-900">✅ Import terminé avec succès</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-orange-600" />
                          <span className="text-orange-900">⚠️ Import terminé avec avertissements</span>
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(), 'dd/MM/yyyy à HH:mm:ss')}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Statistiques visuelles */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-green-600">
                          {importResult.success}
                        </div>
                        <div className="text-sm text-muted-foreground">✅ Réussis</div>
                      </div>
                      
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-red-600">
                          {importResult.failed}
                        </div>
                        <div className="text-sm text-muted-foreground">❌ Échoués</div>
                      </div>
                      
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-blue-600">
                          {importResult.created}
                        </div>
                        <div className="text-sm text-muted-foreground">🆕 Créés</div>
                      </div>
                      
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-purple-600">
                          {importResult.updated}
                        </div>
                        <div className="text-sm text-muted-foreground">🔄 Mis à jour</div>
                      </div>
                    </div>
                    
                    {/* Détails des erreurs */}
                    {importResult.errors.length > 0 && (
                      <Alert variant="destructive" className="bg-white mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <p className="font-semibold">
                              🚨 {importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''} détectée{importResult.errors.length > 1 ? 's' : ''} :
                            </p>
                            <div className="max-h-48 overflow-y-auto bg-red-50 rounded-md p-3 space-y-1">
                              {importResult.errors.map((error, i) => (
                                <div key={i} className="text-xs font-mono border-b border-red-100 pb-1 last:border-0">
                                  <span className="text-red-700 font-bold">#{i + 1}</span> {error}
                                </div>
                              ))}
                            </div>
                            
                            {importResult.errors.length > 20 && (
                              <p className="text-xs text-muted-foreground italic">
                                ℹ️ Certaines erreurs peuvent être dues à des EAN invalides ou des données manquantes
                              </p>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Message de succès complet */}
                    {importResult.failed === 0 && (
                      <Alert className="bg-white border-green-300">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-900">
                          🎉 Tous les produits ont été importés avec succès ! Vous pouvez maintenant consulter vos enrichissements ci-dessous.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Liste des produits importés */}
      {importResult && importResult.success > 0 && lastImportDate && user && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produits importés ({importResult.success})
              </CardTitle>
              <CardDescription>
                Cliquez sur un produit pour voir tous les 52 champs Code2ASIN enrichis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportedProductsList 
                userId={user.id} 
                importDate={lastImportDate}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
