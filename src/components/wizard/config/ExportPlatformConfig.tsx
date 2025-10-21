import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { ShoppingCart, Package, Globe, TestTube } from 'lucide-react';
import { toast } from 'sonner';

interface PlatformConfig {
  platform: string;
  apiUrl?: string;
  apiKey?: string;
  storeId?: string;
  username?: string;
  password?: string;
}

export const ExportPlatformConfig = () => {
  const { updateConfiguration, state } = useWizard();
  const [configs, setConfigs] = useState<Record<string, PlatformConfig>>(
    state.configuration.platformConfigs || {}
  );

  const platforms = state.advancedOptions.exportPlatforms || [];

  const updatePlatformConfig = (platform: string, field: string, value: string) => {
    const newConfigs = {
      ...configs,
      [platform]: {
        ...configs[platform],
        platform,
        [field]: value
      }
    };
    setConfigs(newConfigs);
    updateConfiguration({ platformConfigs: newConfigs });
  };

  const handleTestConnection = (platform: string) => {
    toast.info(`Test de connexion à ${platform}...`);
    // TODO: Implémenter le test de connexion via edge function
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'prestashop': return <ShoppingCart className="h-5 w-5" />;
      case 'woocommerce': return <Package className="h-5 w-5" />;
      case 'shopify': return <Globe className="h-5 w-5" />;
      default: return <ShoppingCart className="h-5 w-5" />;
    }
  };

  const renderPlatformFields = (platform: string) => {
    const config: PlatformConfig = configs[platform] || { platform };

    switch (platform) {
      case 'prestashop':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${platform}-url`}>URL de la boutique *</Label>
              <Input
                id={`${platform}-url`}
                placeholder="https://votre-boutique.com"
                value={config.apiUrl || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiUrl', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${platform}-key`}>Clé API (Webservice Key) *</Label>
              <Input
                id={`${platform}-key`}
                type="password"
                placeholder="Votre clé API PrestaShop"
                value={config.apiKey || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiKey', e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => handleTestConnection(platform)}>
              <TestTube className="h-4 w-4 mr-2" />
              Tester la connexion
            </Button>
          </div>
        );

      case 'woocommerce':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${platform}-url`}>URL WooCommerce *</Label>
              <Input
                id={`${platform}-url`}
                placeholder="https://votre-site.com"
                value={config.apiUrl || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiUrl', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${platform}-key`}>Consumer Key *</Label>
              <Input
                id={`${platform}-key`}
                placeholder="ck_..."
                value={config.apiKey || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiKey', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${platform}-secret`}>Consumer Secret *</Label>
              <Input
                id={`${platform}-secret`}
                type="password"
                placeholder="cs_..."
                value={config.password || ''}
                onChange={(e) => updatePlatformConfig(platform, 'password', e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => handleTestConnection(platform)}>
              <TestTube className="h-4 w-4 mr-2" />
              Tester la connexion
            </Button>
          </div>
        );

      case 'shopify':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${platform}-store`}>Nom du store *</Label>
              <Input
                id={`${platform}-store`}
                placeholder="votre-store"
                value={config.storeId || ''}
                onChange={(e) => updatePlatformConfig(platform, 'storeId', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le nom dans votre-store.myshopify.com
              </p>
            </div>
            <div>
              <Label htmlFor={`${platform}-token`}>Admin API Access Token *</Label>
              <Input
                id={`${platform}-token`}
                type="password"
                placeholder="shpat_..."
                value={config.apiKey || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiKey', e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => handleTestConnection(platform)}>
              <TestTube className="h-4 w-4 mr-2" />
              Tester la connexion
            </Button>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${platform}-url`}>URL API</Label>
              <Input
                id={`${platform}-url`}
                placeholder="https://api.example.com"
                value={config.apiUrl || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiUrl', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${platform}-key`}>Clé API</Label>
              <Input
                id={`${platform}-key`}
                type="password"
                placeholder="Votre clé API"
                value={config.apiKey || ''}
                onChange={(e) => updatePlatformConfig(platform, 'apiKey', e.target.value)}
              />
            </div>
          </div>
        );
    }
  };

  if (platforms.length === 0) {
    return (
      <div className="text-center p-8 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">
          Veuillez d'abord sélectionner des plateformes d'export à l'étape 5 (Options Avancées)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configuration des plateformes d'export</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les accès API pour chaque plateforme sélectionnée
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {platforms.map((platform) => (
          <AccordionItem key={platform} value={platform}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                {getPlatformIcon(platform)}
                <span className="font-medium capitalize">{platform}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardContent className="pt-6">
                  {renderPlatformFields(platform)}
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
