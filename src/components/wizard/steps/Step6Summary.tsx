import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Upload, Download, Sparkles, BarChart3, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const Step6Summary = () => {
  const { state, goToStep, launchOperation } = useWizard();
  const { toast } = useToast();

  const getOperationIcon = () => {
    switch (state.operationType) {
      case 'import': return Upload;
      case 'export': return Download;
      case 'enrichment': return Sparkles;
      case 'analysis': return BarChart3;
      default: return Check;
    }
  };

  const getOperationLabel = () => {
    switch (state.operationType) {
      case 'import': return 'Import Fournisseur';
      case 'export': return 'Export Plateformes';
      case 'enrichment': return 'Enrichissement IA';
      case 'analysis': return 'Analyse Complète';
      default: return 'Opération';
    }
  };

  const handleLaunch = async () => {
    await launchOperation();
    toast({
      title: '🚀 Opération lancée',
      description: 'Le traitement a démarré avec succès',
    });
  };

  const Icon = getOperationIcon();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Résumé & Lancement</h2>
        <p className="text-muted-foreground">Vérifiez les paramètres avant de lancer l'opération</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {getOperationLabel()}
          </CardTitle>
          <CardDescription>Récapitulatif de votre configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type d'opération</p>
              <p className="font-semibold">{getOperationLabel()}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Produits sélectionnés</p>
              <p className="font-semibold">{state.selectedProducts.length}</p>
            </div>

            {state.advancedOptions.autoEnrich && (
              <div>
                <p className="text-sm text-muted-foreground">Auto-enrichissement</p>
                <Badge variant="default">Activé</Badge>
              </div>
            )}

            {state.advancedOptions.exportPlatforms.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Export automatique</p>
                <Badge variant="default">{state.advancedOptions.exportPlatforms.length} plateforme(s)</Badge>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              size="lg"
              className="w-full"
              onClick={handleLaunch}
            >
              <Icon className="h-5 w-5 mr-2" />
              🚀 Lancer Maintenant
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => goToStep(5)} className="flex-1">
          Précédent
        </Button>
        <Button variant="ghost" onClick={() => goToStep(1)} className="flex-1">
          Recommencer
        </Button>
      </div>
    </div>
  );
};
