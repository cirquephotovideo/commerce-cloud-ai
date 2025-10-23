import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Sparkles, Package, Zap } from 'lucide-react';

export const Step5AdvancedOptions = () => {
  const { state, updateAdvancedOptions, goToStep } = useWizard();

  const toggleEnrichmentType = (type: string) => {
    const current = state.advancedOptions.enrichmentTypes;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    updateAdvancedOptions({ enrichmentTypes: updated });
  };

  const toggleExportPlatform = (platform: string) => {
    const current = state.advancedOptions.exportPlatforms;
    const updated = current.includes(platform)
      ? current.filter(p => p !== platform)
      : [...current, platform];
    updateAdvancedOptions({ exportPlatforms: updated });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Options Avancées</h2>
        <p className="text-muted-foreground">Personnalisez le traitement de vos produits</p>
      </div>

      {(state.operationType === 'import' || state.operationType === 'enrichment') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Enrichissement IA
            </CardTitle>
            <CardDescription>Sélectionnez les types d'enrichissement à appliquer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ai-provider">Fournisseur IA</Label>
              <Select
                value={state.advancedOptions.aiProvider}
                onValueChange={(value: any) => updateAdvancedOptions({ aiProvider: value })}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable-ai">Lovable AI (Recommandé)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Types d'enrichissement</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="amazon"
                    checked={state.advancedOptions.enrichmentTypes.includes('amazon')}
                    onCheckedChange={() => toggleEnrichmentType('amazon')}
                  />
                  <Label htmlFor="amazon">Amazon Enrichment</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="specifications"
                    checked={state.advancedOptions.enrichmentTypes.includes('specifications')}
                    onCheckedChange={() => toggleEnrichmentType('specifications')}
                  />
                  <Label htmlFor="specifications">Spécifications techniques</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="images"
                    checked={state.advancedOptions.enrichmentTypes.includes('images')}
                    onCheckedChange={() => toggleEnrichmentType('images')}
                  />
                  <Label htmlFor="images">Images produit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="technical_description"
                    checked={state.advancedOptions.enrichmentTypes.includes('technical_description')}
                    onCheckedChange={() => toggleEnrichmentType('technical_description')}
                  />
                  <Label htmlFor="technical_description">Description technique IA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rsgp"
                    checked={state.advancedOptions.enrichmentTypes.includes('rsgp')}
                    onCheckedChange={() => toggleEnrichmentType('rsgp')}
                  />
                  <Label htmlFor="rsgp">RSGP (Fiches réglementaires)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ai_analysis"
                    checked={state.advancedOptions.enrichmentTypes.includes('ai_analysis')}
                    onCheckedChange={() => toggleEnrichmentType('ai_analysis')}
                  />
                  <Label htmlFor="ai_analysis">Analyse IA complète</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="odoo_attributes"
                    checked={state.advancedOptions.enrichmentTypes.includes('odoo_attributes')}
                    onCheckedChange={() => toggleEnrichmentType('odoo_attributes')}
                  />
                  <Label htmlFor="odoo_attributes" className="flex items-center gap-2">
                    <span>📋 Attributs Odoo (IA + Web Search)</span>
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(state.operationType === 'export' || state.operationType === 'import') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {state.operationType === 'export' ? 'Plateformes d\'export' : 'Export automatique après import'}
            </CardTitle>
            <CardDescription>
              {state.operationType === 'export' 
                ? 'Sélectionnez les plateformes vers lesquelles exporter'
                : 'Exporter automatiquement vers vos plateformes après l\'import'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="shopify"
                checked={state.advancedOptions.exportPlatforms.includes('shopify')}
                onCheckedChange={() => toggleExportPlatform('shopify')}
              />
              <Label htmlFor="shopify">Shopify</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="woocommerce"
                checked={state.advancedOptions.exportPlatforms.includes('woocommerce')}
                onCheckedChange={() => toggleExportPlatform('woocommerce')}
              />
              <Label htmlFor="woocommerce">WooCommerce</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prestashop"
                checked={state.advancedOptions.exportPlatforms.includes('prestashop')}
                onCheckedChange={() => toggleExportPlatform('prestashop')}
              />
              <Label htmlFor="prestashop">PrestaShop</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="odoo"
                checked={state.advancedOptions.exportPlatforms.includes('odoo')}
                onCheckedChange={() => toggleExportPlatform('odoo')}
              />
              <Label htmlFor="odoo">Odoo</Label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(4)}>Précédent</Button>
        <Button onClick={() => goToStep(6)}>Continuer</Button>
      </div>
    </div>
  );
};
