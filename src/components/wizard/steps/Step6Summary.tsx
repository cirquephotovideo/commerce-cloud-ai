import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Upload, Download, Sparkles, BarChart3, Check, Rocket } from 'lucide-react';
import { toast } from 'sonner';

export const Step6Summary = () => {
  const { state, goToStep, launchOperation } = useWizard();

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
    try {
      await launchOperation();
      toast.success('🚀 Opération lancée avec succès !');
    } catch (error) {
      toast.error('Erreur lors du lancement de l\'opération');
      console.error(error);
    }
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
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type d'opération</p>
              <p className="font-semibold">{getOperationLabel()}</p>
            </div>
            
            {state.operationType !== 'analysis' && (
              <div>
                <p className="text-sm text-muted-foreground">Produits</p>
                <p className="font-semibold">
                  {state.selectedProducts.length} sélectionné{state.selectedProducts.length > 1 ? 's' : ''}
                </p>
              </div>
            )}

            {state.source && (
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-semibold capitalize">{state.source.type || 'Non spécifiée'}</p>
              </div>
            )}

            {state.advancedOptions.aiProvider && (
              <div>
                <p className="text-sm text-muted-foreground">Provider IA</p>
                <Badge variant="secondary">{state.advancedOptions.aiProvider}</Badge>
              </div>
            )}
          </div>

          {state.advancedOptions.enrichmentTypes.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Types d'enrichissement</p>
                <div className="flex flex-wrap gap-2">
                  {state.advancedOptions.enrichmentTypes.map(type => (
                    <Badge key={type} variant="outline">
                      {type === 'amazon' && 'Amazon'}
                      {type === 'specifications' && 'Spécifications'}
                      {type === 'images' && 'Images'}
                      {type === 'technical_description' && 'Description IA'}
                      {type === 'rsgp' && 'RSGP'}
                      {type === 'ai_analysis' && 'Analyse IA'}
                      {type === 'cost_analysis' && 'Analyse coûts'}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {state.advancedOptions.exportPlatforms.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Plateformes d'export</p>
                <div className="flex flex-wrap gap-2">
                  {state.advancedOptions.exportPlatforms.map(platform => (
                    <Badge key={platform} variant="default" className="capitalize">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <Button
            size="lg"
            className="w-full"
            onClick={handleLaunch}
          >
            <Rocket className="h-5 w-5 mr-2" />
            Lancer l'opération maintenant
          </Button>
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
