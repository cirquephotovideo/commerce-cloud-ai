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
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [lastImportDate, setLastImportDate] = useState<Date | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
        
        setCsvData(data);
        toast.success(`✅ ${data.length} produits chargés depuis le CSV`);
      },
      error: (error) => {
        toast.error(`Erreur de parsing: ${error.message}`);
      }
    });
  };

  const startImport = async () => {
    if (!csvData) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Non authentifié");
      }

      const response = await supabase.functions.invoke('import-code2asin-csv', {
        body: {
          csvData,
          options: {
            overwrite: overwriteExisting,
            createMissing
          }
        }
      });

      if (response.error) throw response.error;

      const result = response.data.results as ImportResult;
      setImportResult(result);
      setImportProgress(100);

      if (result.success > 0) {
        setLastImportDate(new Date());
        toast.success(`✅ Import réussi: ${result.success} produits enrichis`);
      }
      
      if (result.failed > 0) {
        toast.warning(`⚠️ ${result.failed} produits ont échoué`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur d'import: ${error.message}`);
    } finally {
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
                    Traitement des données en cours...
                  </p>
                </div>
              )}
              
              {/* Résultats */}
              {importResult && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p><strong>Import terminé</strong></p>
                        <p className="text-sm">
                          ✅ {importResult.success} réussis • 
                          ❌ {importResult.failed} échoués • 
                          🆕 {importResult.created} créés • 
                          🔄 {importResult.updated} mis à jour
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  {importResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-semibold">Erreurs détectées:</p>
                          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                            {importResult.errors.slice(0, 10).map((error, i) => (
                              <p key={i}>• {error}</p>
                            ))}
                            {importResult.errors.length > 10 && (
                              <p>... et {importResult.errors.length - 10} autres erreurs</p>
                            )}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
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
