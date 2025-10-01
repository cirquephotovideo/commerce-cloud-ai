import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, CheckCircle } from "lucide-react";

export const OdooSettings = () => {
  const [config, setConfig] = useState({
    odoo_url: "",
    database_name: "",
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('odoo_configurations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          odoo_url: data.odoo_url,
          database_name: data.database_name,
          username: data.username,
          password: "••••••••", // Don't show actual password
        });
        setHasConfig(true);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config.odoo_url || !config.database_name || !config.username || !config.password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (config.password === "••••••••" && hasConfig) {
      toast.error("Veuillez entrer un nouveau mot de passe ou conserver l'ancien");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Deactivate existing configs
      await supabase
        .from('odoo_configurations')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Insert new config
      const { error } = await supabase
        .from('odoo_configurations')
        .insert({
          user_id: user.id,
          odoo_url: config.odoo_url,
          database_name: config.database_name,
          username: config.username,
          password_encrypted: config.password, // In production, encrypt this!
          is_active: true,
        });

      if (error) throw error;

      toast.success("Configuration Odoo enregistrée avec succès");
      setHasConfig(true);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error("Erreur lors de l'enregistrement de la configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuration Odoo</CardTitle>
            <CardDescription>
              Configurez votre connexion à Odoo pour l'export automatique de produits
            </CardDescription>
          </div>
          {hasConfig && (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Configuré
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="odoo_url">URL Odoo</Label>
          <Input
            id="odoo_url"
            placeholder="https://votre-instance.odoo.com"
            value={config.odoo_url}
            onChange={(e) => setConfig({ ...config, odoo_url: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="database_name">Nom de la base de données</Label>
          <Input
            id="database_name"
            placeholder="ma-base-de-donnees"
            value={config.database_name}
            onChange={(e) => setConfig({ ...config, database_name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input
            id="username"
            placeholder="admin"
            value={config.username}
            onChange={(e) => setConfig({ ...config, username: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={config.password}
            onChange={(e) => setConfig({ ...config, password: e.target.value })}
          />
        </div>

        <Button onClick={saveConfig} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer la configuration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
