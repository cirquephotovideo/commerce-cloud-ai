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
import { Loader2 } from "lucide-react";

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
  const [credentials, setCredentials] = useState({
    database: existingConfig?.credentials?.database || "",
    username: existingConfig?.credentials?.username || "",
    password: existingConfig?.credentials?.password || "",
    api_key: existingConfig?.credentials?.api_key || "",
    consumer_key: existingConfig?.credentials?.consumer_key || "",
    consumer_secret: existingConfig?.credentials?.consumer_secret || "",
    access_token: existingConfig?.credentials?.access_token || "",
  });

  const savePlatform = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const configData = {
        user_id: user.id,
        platform_type: platformType,
        platform_url: platformUrl,
        is_active: true,
        credentials: credentials,
      };

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
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
