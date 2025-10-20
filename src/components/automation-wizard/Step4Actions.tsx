import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Step4ActionsProps {
  selectedType: string;
  actionsConfig: any;
  onActionsConfigChange: (config: any) => void;
}

export const Step4Actions = ({ selectedType, actionsConfig, onActionsConfigChange }: Step4ActionsProps) => {
  const toggleAction = (action: string) => {
    onActionsConfigChange({
      ...actionsConfig,
      [action]: !actionsConfig[action],
    });
  };

  const toggleEnrichmentType = (type: string) => {
    const enrichmentTypes = actionsConfig.enrichmentTypes || [];
    const newTypes = enrichmentTypes.includes(type)
      ? enrichmentTypes.filter((t: string) => t !== type)
      : [...enrichmentTypes, type];
    onActionsConfigChange({
      ...actionsConfig,
      enrichmentTypes: newTypes,
    });
  };

  const togglePlatform = (platform: string) => {
    const exportPlatforms = actionsConfig.exportPlatforms || [];
    const newPlatforms = exportPlatforms.includes(platform)
      ? exportPlatforms.filter((p: string) => p !== platform)
      : [...exportPlatforms, platform];
    onActionsConfigChange({
      ...actionsConfig,
      exportPlatforms: newPlatforms,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Actions à effectuer</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez les actions qui seront exécutées automatiquement
        </p>
      </div>

      <div className="space-y-4">
        {/* Enrichissement automatique */}
        {(selectedType === 'import' || selectedType === 'enrichment') && (
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="auto-enrich"
              checked={actionsConfig.autoEnrich}
              onCheckedChange={() => toggleAction('autoEnrich')}
            />
            <div className="flex-1 space-y-3">
              <Label htmlFor="auto-enrich" className="cursor-pointer font-medium">
                🚀 Enrichir automatiquement les nouveaux produits
              </Label>
              {actionsConfig.autoEnrich && (
                <div className="space-y-2 pl-2">
                  <Label className="text-sm text-muted-foreground">Types d'enrichissement :</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'specs', label: 'Spécifications techniques' },
                      { id: 'costs', label: 'Analyse coûts/marges' },
                      { id: 'desc', label: 'Description technique' },
                      { id: 'amazon', label: 'Images Amazon' },
                    ].map((type) => (
                      <div key={type.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`enrich-${type.id}`}
                          checked={(actionsConfig.enrichmentTypes || []).includes(type.id)}
                          onCheckedChange={() => toggleEnrichmentType(type.id)}
                        />
                        <Label htmlFor={`enrich-${type.id}`} className="text-sm cursor-pointer font-normal">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Liaison automatique */}
        {(selectedType === 'import' || selectedType === 'linking') && (
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="auto-link"
              checked={actionsConfig.autoLink}
              onCheckedChange={() => toggleAction('autoLink')}
            />
            <div className="flex-1 space-y-3">
              <Label htmlFor="auto-link" className="cursor-pointer font-medium">
                🔗 Liaison automatique avec le catalogue
              </Label>
              {actionsConfig.autoLink && (
                <div className="space-y-2 pl-2">
                  <Label className="text-sm text-muted-foreground">
                    Seuil de confiance minimum : {actionsConfig.linkConfidence || 80}%
                  </Label>
                  <Slider
                    value={[actionsConfig.linkConfidence || 80]}
                    onValueChange={([v]) =>
                      onActionsConfigChange({ ...actionsConfig, linkConfidence: v })
                    }
                    min={50}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alertes conditionnelles */}
        {selectedType === 'import' && (
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="auto-alerts"
              checked={actionsConfig.autoAlerts}
              onCheckedChange={() => toggleAction('autoAlerts')}
            />
            <div className="flex-1 space-y-3">
              <Label htmlFor="auto-alerts" className="cursor-pointer font-medium">
                🔔 Créer des alertes si...
              </Label>
              {actionsConfig.autoAlerts && (
                <div className="space-y-2 pl-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="alert-price" defaultChecked />
                    <Label htmlFor="alert-price" className="text-sm cursor-pointer font-normal">
                      Prix augmente de plus de
                    </Label>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      defaultValue="10"
                      onChange={(e) =>
                        onActionsConfigChange({
                          ...actionsConfig,
                          priceThreshold: Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="alert-stock" defaultChecked />
                    <Label htmlFor="alert-stock" className="text-sm cursor-pointer font-normal">
                      Stock passe sous
                    </Label>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      defaultValue="5"
                      onChange={(e) =>
                        onActionsConfigChange({
                          ...actionsConfig,
                          stockThreshold: Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-sm">unités</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export automatique */}
        {(selectedType === 'import' || selectedType === 'export') && (
          <div className="flex items-start space-x-3 p-4 border rounded-lg">
            <Checkbox
              id="auto-export"
              checked={actionsConfig.autoExport}
              onCheckedChange={() => toggleAction('autoExport')}
            />
            <div className="flex-1 space-y-3">
              <Label htmlFor="auto-export" className="cursor-pointer font-medium">
                📤 Exporter vers les plateformes
              </Label>
              {actionsConfig.autoExport && (
                <div className="space-y-2 pl-2">
                  <Label className="text-sm text-muted-foreground">Plateformes cibles :</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Shopify', 'PrestaShop', 'WooCommerce', 'Odoo', 'Magento'].map((platform) => (
                      <Badge
                        key={platform}
                        variant={(actionsConfig.exportPlatforms || []).includes(platform) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => togglePlatform(platform)}
                      >
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
