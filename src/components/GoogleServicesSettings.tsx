import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingCart, BarChart3, Search } from "lucide-react";

type ServiceType = 'merchant_center' | 'shopping_api' | 'analytics' | 'search_console';

interface GoogleServiceConfig {
  id?: string;
  service_type: ServiceType;
  merchant_id?: string;
  api_key_encrypted?: string;
  client_id_encrypted?: string;
  client_secret_encrypted?: string;
  measurement_id?: string;
  site_url?: string;
  is_active: boolean;
}

export const GoogleServicesSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<Record<ServiceType, GoogleServiceConfig>>({
    merchant_center: { service_type: 'merchant_center', is_active: true },
    shopping_api: { service_type: 'shopping_api', is_active: true },
    analytics: { service_type: 'analytics', is_active: true },
    search_console: { service_type: 'search_console', is_active: true },
  });

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('google_services_config')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const configMap = { ...configs };
        data.forEach((config: any) => {
          configMap[config.service_type as ServiceType] = config;
        });
        setConfigs(configMap);
      }
    } catch (error) {
      console.error('Error loading Google configurations:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les configurations Google",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async (serviceType: ServiceType) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const config = configs[serviceType];
      const payload = {
        user_id: user.id,
        service_type: serviceType,
        merchant_id: config.merchant_id || null,
        api_key_encrypted: config.api_key_encrypted || null,
        client_id_encrypted: config.client_id_encrypted || null,
        client_secret_encrypted: config.client_secret_encrypted || null,
        measurement_id: config.measurement_id || null,
        site_url: config.site_url || null,
        is_active: config.is_active,
      };

      const { error } = await supabase
        .from('google_services_config')
        .upsert(payload, { onConflict: 'user_id,service_type' });

      if (error) throw error;

      toast({
        title: "Configuration enregistrée",
        description: "Les paramètres Google ont été mis à jour avec succès",
      });
    } catch (error) {
      console.error('Error saving Google configuration:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (serviceType: ServiceType, field: string, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [serviceType]: {
        ...prev[serviceType],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Google Services</CardTitle>
        <CardDescription>
          Configurez vos services Google (Merchant Center, Shopping API, Analytics, Search Console)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="merchant_center" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="merchant_center">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Merchant
            </TabsTrigger>
            <TabsTrigger value="shopping_api">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Shopping
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="search_console">
              <Search className="h-4 w-4 mr-2" />
              Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="merchant_center" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="merchant-active">Service actif</Label>
                <Switch
                  id="merchant-active"
                  checked={configs.merchant_center.is_active}
                  onCheckedChange={(checked) => updateConfig('merchant_center', 'is_active', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant-id">Merchant ID</Label>
                <Input
                  id="merchant-id"
                  placeholder="123456789"
                  value={configs.merchant_center.merchant_id || ''}
                  onChange={(e) => updateConfig('merchant_center', 'merchant_id', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant-api-key">API Key</Label>
                <Input
                  id="merchant-api-key"
                  type="password"
                  placeholder="Votre clé API Google"
                  value={configs.merchant_center.api_key_encrypted || ''}
                  onChange={(e) => updateConfig('merchant_center', 'api_key_encrypted', e.target.value)}
                />
              </div>
              <Button 
                onClick={() => saveConfiguration('merchant_center')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer Merchant Center
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="shopping_api" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="shopping-active">Service actif</Label>
                <Switch
                  id="shopping-active"
                  checked={configs.shopping_api.is_active}
                  onCheckedChange={(checked) => updateConfig('shopping_api', 'is_active', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopping-api-key">API Key</Label>
                <Input
                  id="shopping-api-key"
                  type="password"
                  placeholder="Votre clé API Shopping"
                  value={configs.shopping_api.api_key_encrypted || ''}
                  onChange={(e) => updateConfig('shopping_api', 'api_key_encrypted', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopping-client-id">Client ID</Label>
                <Input
                  id="shopping-client-id"
                  placeholder="Client ID OAuth 2.0"
                  value={configs.shopping_api.client_id_encrypted || ''}
                  onChange={(e) => updateConfig('shopping_api', 'client_id_encrypted', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopping-client-secret">Client Secret</Label>
                <Input
                  id="shopping-client-secret"
                  type="password"
                  placeholder="Client Secret OAuth 2.0"
                  value={configs.shopping_api.client_secret_encrypted || ''}
                  onChange={(e) => updateConfig('shopping_api', 'client_secret_encrypted', e.target.value)}
                />
              </div>
              <Button 
                onClick={() => saveConfiguration('shopping_api')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer Shopping API
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="analytics-active">Service actif</Label>
                <Switch
                  id="analytics-active"
                  checked={configs.analytics.is_active}
                  onCheckedChange={(checked) => updateConfig('analytics', 'is_active', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="measurement-id">Measurement ID</Label>
                <Input
                  id="measurement-id"
                  placeholder="G-XXXXXXXXXX"
                  value={configs.analytics.measurement_id || ''}
                  onChange={(e) => updateConfig('analytics', 'measurement_id', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="analytics-api-key">API Key (optionnel)</Label>
                <Input
                  id="analytics-api-key"
                  type="password"
                  placeholder="Pour l'API Analytics"
                  value={configs.analytics.api_key_encrypted || ''}
                  onChange={(e) => updateConfig('analytics', 'api_key_encrypted', e.target.value)}
                />
              </div>
              <Button 
                onClick={() => saveConfiguration('analytics')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer Analytics
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="search_console" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="search-active">Service actif</Label>
                <Switch
                  id="search-active"
                  checked={configs.search_console.is_active}
                  onCheckedChange={(checked) => updateConfig('search_console', 'is_active', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-url">Site URL</Label>
                <Input
                  id="site-url"
                  placeholder="https://votre-site.com"
                  value={configs.search_console.site_url || ''}
                  onChange={(e) => updateConfig('search_console', 'site_url', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-api-key">API Key</Label>
                <Input
                  id="search-api-key"
                  type="password"
                  placeholder="Votre clé API Search Console"
                  value={configs.search_console.api_key_encrypted || ''}
                  onChange={(e) => updateConfig('search_console', 'api_key_encrypted', e.target.value)}
                />
              </div>
              <Button 
                onClick={() => saveConfiguration('search_console')}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer Search Console
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
