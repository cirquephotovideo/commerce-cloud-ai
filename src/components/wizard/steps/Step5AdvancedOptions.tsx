import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWizard } from '@/contexts/UniversalWizardContext';

export const Step5AdvancedOptions = () => {
  const { state, updateAdvancedOptions, goToStep } = useWizard();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Options Avancées</h2>
        <p className="text-muted-foreground">Personnalisez le traitement de vos produits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automatisation</CardTitle>
          <CardDescription>Automatisez les actions après l'opération principale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-enrich">Auto-enrichir après import</Label>
            <Switch
              id="auto-enrich"
              checked={state.advancedOptions.autoEnrich}
              onCheckedChange={(checked) => updateAdvancedOptions({ autoEnrich: checked })}
            />
          </div>

          {state.advancedOptions.autoEnrich && (
            <div className="ml-6 space-y-2 border-l-2 pl-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="amazon" />
                <Label htmlFor="amazon">Amazon Enrichment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="images" />
                <Label htmlFor="images">Génération d'images IA</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="video" />
                <Label htmlFor="video">Génération de vidéos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="rsgp" />
                <Label htmlFor="rsgp">RSGP (Fiches techniques)</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Automatique</CardTitle>
          <CardDescription>Exporter automatiquement vers vos plateformes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="shopify" />
            <Label htmlFor="shopify">Shopify</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="woocommerce" />
            <Label htmlFor="woocommerce">WooCommerce</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="prestashop" />
            <Label htmlFor="prestashop">PrestaShop</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="odoo" />
            <Label htmlFor="odoo">Odoo</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(4)}>Précédent</Button>
        <Button onClick={() => goToStep(6)}>Continuer</Button>
      </div>
    </div>
  );
};
