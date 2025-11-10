import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Code2AsinExport() {
  const [exportedFiles, setExportedFiles] = useState<{
    filename: string;
    url: string;
    eanCount: number;
    batchNumber: number;
  }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all non-enriched products with EAN
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['non-enriched-products-ean'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_analyses')
        .select('ean')
        .not('ean', 'is', null)
        .neq('ean', '')
        .in('code2asin_enrichment_status', ['not_started', 'failed'])
        .limit(100000)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const generateBatchFiles = () => {
    if (products.length === 0) {
      toast.error("Aucun produit non-enrichi trouvé");
      return;
    }

    setIsGenerating(true);
    
    try {
      const eans = products.map(p => p.ean).filter(Boolean);
      const BATCH_SIZE = 25000;
      const batches: string[][] = [];
      
      // Découper en blocs de 25 000
      for (let i = 0; i < eans.length; i += BATCH_SIZE) {
        batches.push(eans.slice(i, i + BATCH_SIZE));
      }
      
      // Générer les fichiers avec Blob URLs persistants
      const files = batches.map((batch, index) => {
        const csv = 'EAN\n' + batch.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const filename = `code2asin_batch${index + 1}_${batch.length}EAN_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
        
        return {
          filename,
          url,
          eanCount: batch.length,
          batchNumber: index + 1
        };
      });
      
      setExportedFiles(files);
      
      toast.success(
        `✅ ${batches.length} fichier(s) généré(s) avec ${eans.length.toLocaleString()} EAN`,
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Erreur génération fichiers:', error);
      toast.error("Erreur lors de la génération des fichiers");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            📤 Export EAN pour Code2ASIN
          </CardTitle>
          <CardDescription>
            Exportez tous vos produits non-enrichis par blocs de 25 000 EAN maximum pour enrichissement via code2asin.com
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Stats */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{products.length.toLocaleString()}</strong> produits non-enrichis disponibles • 
              <strong className="ml-2">{Math.ceil(products.length / 25000)}</strong> fichier{Math.ceil(products.length / 25000) > 1 ? 's' : ''} seront générés
              {products.length > 25000 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (blocs de 25 000 EAN maximum)
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Bouton de génération */}
          <Button
            onClick={generateBatchFiles}
            disabled={products.length === 0 || isGenerating}
            className="w-full justify-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            size="lg"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Génération en cours...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-5 w-5 mr-2" />
                🚀 Générer les fichiers d'export
                <span className="ml-2 bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
                  {products.length.toLocaleString()} EAN → {Math.ceil(products.length / 25000)} fichier{Math.ceil(products.length / 25000) > 1 ? 's' : ''}
                </span>
              </>
            )}
          </Button>

          {/* Liste des fichiers générés */}
          {exportedFiles.length > 0 && (
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/30">
              <CardHeader>
                <CardTitle className="text-green-900 dark:text-green-50 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  📦 Fichiers prêts au téléchargement
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  {exportedFiles.length} fichier{exportedFiles.length > 1 ? 's' : ''} généré{exportedFiles.length > 1 ? 's' : ''} • 
                  Total : {exportedFiles.reduce((sum, f) => sum + f.eanCount, 0).toLocaleString()} EAN
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {exportedFiles.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/70 rounded-lg border border-green-200 dark:border-green-800/50 hover:border-green-300 dark:hover:border-green-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/70 p-2 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            Fichier {file.batchNumber}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            {file.eanCount.toLocaleString()} EAN
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                      >
                        <a href={file.url} download={file.filename}>
                          <Download className="h-4 w-4 mr-1" />
                          Télécharger
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>

                <Alert className="mt-4 bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-gray-800 dark:text-gray-100">
                    💡 Uploadez ces fichiers sur <strong>code2asin.com</strong> pour enrichir vos données Amazon
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
