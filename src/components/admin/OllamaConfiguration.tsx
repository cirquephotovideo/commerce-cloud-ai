import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Server, TestTube } from "lucide-react";
import { ImportExportButtons } from "./ImportExportButtons";

export const OllamaConfiguration = () => {
  const [config, setConfig] = useState({
    ollama_url: "",
    api_key_encrypted: "",
    available_models: [] as string[],
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("ollama_configurations")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const models = Array.isArray(data.available_models) 
          ? data.available_models as string[]
          : [];
        
        setConfig({
          ollama_url: data.ollama_url,
          api_key_encrypted: data.api_key_encrypted || "",
          available_models: models,
          is_active: data.is_active,
        });
      }
    } catch (error) {
      console.error("Error fetching Ollama config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.ollama_url) {
      toast.error("Entrez l'URL de votre Mac Mini");
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'test',
          ollama_url: config.ollama_url,
          api_key: config.api_key_encrypted,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Connexion réussie !");
        if (data.models) {
          setConfig(prev => ({ ...prev, available_models: data.models }));
        }
      } else {
        toast.error("Échec de la connexion");
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Erreur de test de connexion");
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("ollama_configurations")
        .upsert({
          user_id: session.user.id,
          ...config,
        });

      if (error) throw error;

      toast.success("Configuration sauvegardée");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (data: any) => {
    if (!Array.isArray(data)) {
      throw new Error('Format invalide: un tableau de configurations est attendu');
    }

    for (const configItem of data) {
      const { error } = await supabase.from('ollama_configurations').upsert(configItem);
      if (error) throw error;
    }

    await fetchConfig();
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>Configuration Ollama Cloud</CardTitle>
            </div>
            <CardDescription>
              Connectez votre Mac Mini M4 avec Ollama pour utiliser l'IA en local
            </CardDescription>
          </div>
          <ImportExportButtons
            data={[config]}
            filename="ollama-config"
            onImport={handleImport}
            disabled={isLoading}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="ollama_url">URL du Mac Mini (Ollama)</Label>
          <Input
            id="ollama_url"
            placeholder="http://192.168.1.100:11434"
            value={config.ollama_url}
            onChange={(e) => setConfig({ ...config, ollama_url: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Exemple: http://votre-ip-locale:11434
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_key">Clé API (optionnelle)</Label>
          <Input
            id="api_key"
            type="password"
            placeholder="Votre clé API Ollama"
            value={config.api_key_encrypted}
            onChange={(e) => setConfig({ ...config, api_key_encrypted: e.target.value })}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={config.is_active}
            onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
          />
          <Label htmlFor="is_active">Activer Ollama Cloud</Label>
        </div>

        {config.available_models.length > 0 && (
          <div className="space-y-2">
            <Label>Modèles Disponibles</Label>
            <div className="flex flex-wrap gap-2">
              {config.available_models.map((model) => (
                <Badge key={model} variant="secondary">{model}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={isTesting}
          >
            <TestTube className="w-4 h-4 mr-2" />
            {isTesting ? "Test en cours..." : "Tester la Connexion"}
          </Button>
          
          <Button
            onClick={saveConfig}
            disabled={isSaving}
          >
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};