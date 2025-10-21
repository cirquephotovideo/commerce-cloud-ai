import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { ProductPreviewCard } from './ProductPreviewCard';
import { ScrollArea } from '@/components/ui/scroll-area';

export const ResultsPanel = () => {
  const { state } = useWizard();
  const { results, selectedProducts } = state;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Aperçu en Temps Réel
          {results.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {results.status === 'completed' && <CheckCircle className="h-5 w-5 text-success" />}
          {results.status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
        </CardTitle>
        <CardDescription>
          {results.status === 'idle' && 'Les résultats apparaîtront ici en temps réel'}
          {results.status === 'processing' && 'Traitement en cours...'}
          {results.status === 'completed' && 'Opération terminée avec succès'}
          {results.status === 'error' && 'Une erreur est survenue'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-350px)]">
          {selectedProducts.length > 0 && results.preview && (
            <div className="space-y-4">
              <ProductPreviewCard analysisId={selectedProducts[0]} />
            </div>
          )}
          
          {results.logs.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="font-semibold text-sm">Logs d'exécution</h4>
              <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs space-y-1">
                {results.logs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.status === 'idle' && selectedProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">🔮</div>
              <p className="text-muted-foreground">
                Configurez votre opération pour voir les résultats apparaître ici
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
