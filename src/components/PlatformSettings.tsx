import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PLATFORMS = [
  { value: 'shopify', label: '🏪 Shopify', icon: '🏪' },
  { value: 'woocommerce', label: '🌐 WooCommerce', icon: '🌐' },
  { value: 'prestashop', label: '🛒 PrestaShop', icon: '🛒' },
  { value: 'magento', label: '📦 Magento', icon: '📦' },
  { value: 'salesforce', label: '☁️ Salesforce', icon: '☁️' },
  { value: 'sap', label: '🏢 SAP', icon: '🏢' },
  { value: 'uber_eats', label: '🍔 Uber Eats', icon: '🍔' },
  { value: 'deliveroo', label: '🚚 Deliveroo', icon: '🚚' },
  { value: 'just_eat', label: '📱 Just Eat', icon: '📱' },
  { value: 'windev', label: '💻 WinDev', icon: '💻' },
];

export const PlatformSettings = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('shopify');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    platform_url: '',
    api_key_encrypted: '',
    api_secret_encrypted: '',
    access_token_encrypted: '',
  });

  useEffect(() => {
    loadConfiguration();
  }, [selectedPlatform]);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('platform_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform_type', selectedPlatform)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          platform_url: data.platform_url || '',
          api_key_encrypted: data.api_key_encrypted || '',
          api_secret_encrypted: data.api_secret_encrypted || '',
          access_token_encrypted: data.access_token_encrypted || '',
        });
      } else {
        setConfig({
          platform_url: '',
          api_key_encrypted: '',
          api_secret_encrypted: '',
          access_token_encrypted: '',
        });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast.error('Error loading configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('platform_configurations')
        .upsert({
          user_id: user.id,
          platform_type: selectedPlatform,
          ...config,
          is_active: true,
        });

      if (error) throw error;

      toast.success(`Configuration ${selectedPlatform} saved successfully`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const getPlatformFields = () => {
    switch (selectedPlatform) {
      case 'shopify':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="platform_url">Store URL</Label>
              <Input
                id="platform_url"
                placeholder="https://your-store.myshopify.com"
                value={config.platform_url}
                onChange={(e) => setConfig({ ...config, platform_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="shpat_xxxxx"
                value={config.access_token_encrypted}
                onChange={(e) => setConfig({ ...config, access_token_encrypted: e.target.value })}
              />
            </div>
          </>
        );
      case 'woocommerce':
      case 'prestashop':
      case 'magento':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="platform_url">Store URL</Label>
              <Input
                id="platform_url"
                placeholder="https://your-store.com"
                value={config.platform_url}
                onChange={(e) => setConfig({ ...config, platform_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key_encrypted}
                onChange={(e) => setConfig({ ...config, api_key_encrypted: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_secret">API Secret</Label>
              <Input
                id="api_secret"
                type="password"
                value={config.api_secret_encrypted}
                onChange={(e) => setConfig({ ...config, api_secret_encrypted: e.target.value })}
              />
            </div>
          </>
        );
      case 'salesforce':
      case 'sap':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="platform_url">Instance URL</Label>
              <Input
                id="platform_url"
                placeholder="https://your-instance.salesforce.com"
                value={config.platform_url}
                onChange={(e) => setConfig({ ...config, platform_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_key">Client ID</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key_encrypted}
                onChange={(e) => setConfig({ ...config, api_key_encrypted: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_secret">Client Secret</Label>
              <Input
                id="api_secret"
                type="password"
                value={config.api_secret_encrypted}
                onChange={(e) => setConfig({ ...config, api_secret_encrypted: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token</Label>
              <Input
                id="access_token"
                type="password"
                value={config.access_token_encrypted}
                onChange={(e) => setConfig({ ...config, access_token_encrypted: e.target.value })}
              />
            </div>
          </>
        );
      case 'uber_eats':
      case 'deliveroo':
      case 'just_eat':
      case 'windev':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="platform_url">API URL</Label>
              <Input
                id="platform_url"
                placeholder="https://api.platform.com"
                value={config.platform_url}
                onChange={(e) => setConfig({ ...config, platform_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key_encrypted}
                onChange={(e) => setConfig({ ...config, api_key_encrypted: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_secret">API Secret</Label>
              <Input
                id="api_secret"
                type="password"
                value={config.api_secret_encrypted}
                onChange={(e) => setConfig({ ...config, api_secret_encrypted: e.target.value })}
              />
            </div>
          </>
        );
      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            Configuration for {selectedPlatform} coming soon...
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          Platform Configuration
        </CardTitle>
        <CardDescription>
          Configure your e-commerce platform connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="platform">Select Platform</Label>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform.value} value={platform.value}>
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {getPlatformFields()}
            {![''].includes(selectedPlatform) && (
              <Button onClick={saveConfiguration} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
