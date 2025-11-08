import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlatformConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformId?: string;
  existingConfig?: any;
}

export const PlatformConfigDialog = ({
  open,
  onOpenChange,
  platformId,
  existingConfig,
}: PlatformConfigDialogProps) => {
  const queryClient = useQueryClient();
  const [platformType, setPlatformType] = useState(existingConfig?.platform_type || "odoo");
  const [platformUrl, setPlatformUrl] = useState(existingConfig?.platform_url || "");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [credentials, setCredentials] = useState<any>(() => {
    if (!existingConfig) {
      return {
        database: "",
        username: "",
        password: "",
        api_key: "",
        consumer_key: "",
        consumer_secret: "",
        access_token: "",
      };
    }

    // Reconstruct credentials from correct columns based on platform type
    if (existingConfig.platform_type === 'odoo') {
      return existingConfig.additional_config || {};
    } else if (existingConfig.platform_type === 'prestashop') {
      return { api_key: existingConfig.api_key_encrypted || '' };
    } else if (existingConfig.platform_type === 'woocommerce') {
      return {
        consumer_key: existingConfig.api_key_encrypted || '',
        consumer_secret: existingConfig.api_secret_encrypted || ''
      };
    } else if (existingConfig.platform_type === 'shopify') {
      return { access_token: existingConfig.access_token_encrypted || '' };
    } else if (existingConfig.platform_type === 'magento') {
      return {
        consumer_key: existingConfig.api_key_encrypted || '',
        consumer_secret: existingConfig.api_secret_encrypted || '',
        access_token: existingConfig.access_token_encrypted || ''
      };
    }
    return {};
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-platform-connection', {
        body: {
          platform_type: platformType,
          platform_url: platformUrl,
          credentials,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult({ success: true, message: data.message });
      toast.success('Connexion réussie ! ✓');
    },
    onError: (error: any) => {
      const message = error?.message || 'Échec de la connexion';
      setTestResult({ success: false, message });
      toast.error(`Échec du test : ${message}`);
    },
  });

  const savePlatform = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      let configData: any = {
        user_id: user.id,
        platform_type: platformType,
        platform_url: platformUrl,
        is_active: true,
      };

      // Map credentials to correct columns based on platform type
      if (platformType === 'odoo') {
        configData.additional_config = {
          username: credentials.username,
          password: credentials.password,
          database: credentials.database
        };
      } else if (platformType === 'prestashop') {
        configData.api_key_encrypted = credentials.api_key;
      } else if (platformType === 'woocommerce') {
        configData.api_key_encrypted = credentials.consumer_key;
        configData.api_secret_encrypted = credentials.consumer_secret;
      } else if (platformType === 'shopify') {
        configData.access_token_encrypted = credentials.access_token;
      } else if (platformType === 'magento') {
        configData.api_key_encrypted = credentials.consumer_key;
        configData.api_secret_encrypted = credentials.consumer_secret;
        configData.access_token_encrypted = credentials.access_token;
      }

      if (platformId) {
        const { error } = await supabase
          .from('platform_configurations')
          .update(configData)
          .eq('id', platformId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_configurations')
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        platformId
          ? 'Configuration mise à jour avec succès'
          : 'Plateforme ajoutée avec succès'
      );
      queryClient.invalidateQueries({ queryKey: ['platform-configurations'] });
      onOpenChange(false);
      setTestResult(null);
    },
    onError: (error: Error) => {
      console.error('Erreur sauvegarde config:', error);
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const renderCredentialFields = () => {
    switch (platformType) {
      case "odoo":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="database">Base de données</Label>
              <Input
                id="database"
                value={credentials.database}
                onChange={(e) =>
                  setCredentials({ ...credentials, database: e.target.value })
                }
                placeholder="nom_database"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
              />
            </div>
          </>
        );

      case "prestashop":
        return (
          <div className="space-y-2">
            <Label htmlFor="api_key">Clé API</Label>
            <Input
              id="api_key"
              value={credentials.api_key}
              onChange={(e) =>
                setCredentials({ ...credentials, api_key: e.target.value })
              }
              placeholder="XXXXXXXXXXXXXXXXXXXXX"
            />
          </div>
        );

      case "woocommerce":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="consumer_key">Consumer Key</Label>
              <Input
                id="consumer_key"
                value={credentials.consumer_key}
                onChange={(e) =>
                  setCredentials({ ...credentials, consumer_key: e.target.value })
                }
                placeholder="ck_xxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumer_secret">Consumer Secret</Label>
              <Input
                id="consumer_secret"
                type="password"
                value={credentials.consumer_secret}
                onChange={(e) =>
                  setCredentials({ ...credentials, consumer_secret: e.target.value })
                }
                placeholder="cs_xxxxxxxxxxxxx"
              />
            </div>
          </>
        );

      case "shopify":
        return (
          <div className="space-y-2">
            <Label htmlFor="access_token">Access Token</Label>
            <Input
              id="access_token"
              type="password"
              value={credentials.access_token}
              onChange={(e) =>
                setCredentials({ ...credentials, access_token: e.target.value })
              }
              placeholder="shpat_xxxxxxxxxxxxx"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {platformId ? "Modifier la configuration" : "Ajouter une plateforme"}
          </DialogTitle>
          <DialogDescription>
            Configurez la connexion à votre plateforme e-commerce
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform_type">Type de plateforme</Label>
            <Select value={platformType} onValueChange={setPlatformType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="odoo">Odoo ERP</SelectItem>
                <SelectItem value="prestashop">PrestaShop</SelectItem>
                <SelectItem value="woocommerce">WooCommerce</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="magento">Magento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform_url">URL de la plateforme</Label>
            <Input
              id="platform_url"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              placeholder="https://votre-boutique.com"
            />
          </div>

          {renderCredentialFields()}
        </div>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              )}
              <AlertDescription className="text-sm">
                {testResult.message}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="secondary"
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending || !platformUrl}
          >
            {testConnection.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Tester la connexion
          </Button>
          <Button
            onClick={() => savePlatform.mutate()}
            disabled={savePlatform.isPending || !platformUrl}
          >
            {savePlatform.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {platformId ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
