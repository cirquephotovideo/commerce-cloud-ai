import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Server, TestTube, Settings, Cloud, HardDrive, RefreshCw } from "lucide-react";
import { ImportExportButtons } from "./ImportExportButtons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const CLOUD_MODELS = [
  'deepseek-v3.1:671b-cloud',
  'gpt-oss:20b-cloud',
  'gpt-oss:120b-cloud',
  'kimi-k2:1t-cloud',
  'qwen3-coder:480b-cloud',
  'glm-4.6:cloud'
];

const LOCAL_MODELS = [
  'llama2', 'llama3', 'llama3.1', 'mistral', 'mixtral', 
  'gemma', 'gemma2', 'qwen', 'phi3', 'deepseek-coder'
];

export const OllamaConfiguration = () => {
  const [config, setConfig] = useState({
    ollama_url: "http://localhost:11434",
    api_key_encrypted: "",
    available_models: [] as string[],
    is_active: true,
  });
  const [selectedModel, setSelectedModel] = useState("llama3");
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [webSearchResults, setWebSearchResults] = useState<any>(null);
  const [isTestingWebSearch, setIsTestingWebSearch] = useState(false);

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
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        // Prendre la dernière configuration en cas de doublons
        const latestConfig = data[0];
        const models = Array.isArray(latestConfig.available_models) 
          ? latestConfig.available_models as string[]
          : [];
        
        const url = latestConfig.ollama_url || "http://localhost:11434";
        const isCloud = url === "https://ollama.com";
        
        setConfig({
          ollama_url: url,
          api_key_encrypted: latestConfig.api_key_encrypted || "",
          available_models: models.length > 0 ? models : (isCloud ? CLOUD_MODELS : LOCAL_MODELS),
          is_active: latestConfig.is_active,
        });
        
        setSelectedModel(isCloud ? 'gpt-oss:120b-cloud' : 'llama3');
        setIsCloudMode(isCloud);
      }
    } catch (error) {
      console.error("Error fetching Ollama config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.api_key_encrypted) {
      toast.error("Entrez votre clé API Ollama");
      return;
    }

    setIsTesting(true);
    try {
      // Mode Local : test direct depuis le navigateur (bypass edge function)
      if (!isCloudMode) {
        try {
          const response = await fetch(`${config.ollama_url}/api/tags`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.api_key_encrypted}`,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          const models = data.models?.map((m: any) => m.name) || [];
          
          toast.success("Connexion locale réussie !");
          setConfig(prev => ({ ...prev, available_models: models }));
          return;
        } catch (error) {
          console.error("Local test error:", error);
          toast.error("Impossible de se connecter à Ollama local. Vérifiez que Ollama est démarré sur votre Mac Mini M4.");
          return;
        }
      }

      // Mode Cloud : test via edge function
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'test',
          ollama_url: config.ollama_url,
          api_key: config.api_key_encrypted,
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(`Échec de la connexion: ${data.error}`);
      } else if (data?.success) {
        toast.success("Connexion Cloud réussie !");
        if (data.models) {
          setConfig(prev => ({ ...prev, available_models: data.models }));
        }
      } else {
        toast.error("Échec de la connexion");
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur de test de connexion: ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testWebSearch = async () => {
    if (!testPrompt.trim()) {
      toast.error("Entrez un prompt de test");
      return;
    }

    if (!isCloudMode) {
      toast.error("Web Search n'est disponible qu'en mode Cloud");
      return;
    }

    setIsTestingWebSearch(true);
    setWebSearchResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'chat',
          ollama_url: config.ollama_url,
          api_key: config.api_key_encrypted,
          model: selectedModel,
          web_search: true,
          messages: [
            { role: 'user', content: testPrompt }
          ]
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(`Erreur: ${data.error}`);
      } else if (data?.success) {
        toast.success("Recherche web réussie !");
        setWebSearchResults(data.response);
      } else {
        toast.error("Échec de la recherche web");
      }
    } catch (error) {
      console.error("Error testing web search:", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${message}`);
    } finally {
      setIsTestingWebSearch(false);
    }
  };

  const handleModeChange = (mode: 'local' | 'cloud') => {
    if (mode === 'cloud') {
      setConfig(prev => ({ 
        ...prev, 
        ollama_url: 'https://ollama.com',
        available_models: CLOUD_MODELS
      }));
      setSelectedModel('gpt-oss:120b-cloud');
      setIsCloudMode(true);
    } else {
      setConfig(prev => ({ 
        ...prev, 
        ollama_url: 'http://localhost:11434',
        available_models: LOCAL_MODELS
      }));
      setSelectedModel('llama3');
      setIsCloudMode(false);
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
          ollama_url: config.ollama_url || "http://localhost:11434",
          api_key_encrypted: config.api_key_encrypted,
          available_models: config.available_models,
          is_active: config.is_active,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      // Appeler automatiquement la synchronisation
      await syncToProviders();

      toast.success("Configuration sauvegardée et synchronisée");
    } catch (error) {
      console.error("Error saving config:", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur lors de la sauvegarde: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const syncToProviders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

      const { data, error } = await supabase.functions.invoke('sync-ollama-to-providers', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      if (data?.success) {
        console.log('Synchronisation réussie:', data);
      } else {
        console.warn('Synchronisation partielle:', data);
      }
    } catch (error) {
      console.error('Sync error:', error);
      // Ne pas afficher d'erreur à l'utilisateur car c'est un processus automatique
    }
  };

  const handleImport = async (data: any) => {
    if (!Array.isArray(data)) {
      throw new Error('Format invalide: un tableau de configurations est attendu');
    }

    for (const configItem of data) {
      const { error } = await supabase
        .from('ollama_configurations')
        .upsert(configItem, { onConflict: 'user_id' });
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
              <CardTitle>Configuration Ollama</CardTitle>
            </div>
            <CardDescription>
              {isCloudMode 
                ? "Utilisez Ollama Cloud pour accéder aux modèles cloud (deepseek-v3.1:671b-cloud, gpt-oss:120b-cloud, etc.)"
                : "Connectez votre Mac Mini M4 avec Ollama pour utiliser l'IA en local"
              }
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
        <div className="space-y-3">
          <Label>Mode d'utilisation</Label>
          <RadioGroup 
            value={isCloudMode ? 'cloud' : 'local'} 
            onValueChange={(value) => handleModeChange(value as 'local' | 'cloud')}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="local" id="local" />
              <Label htmlFor="local" className="flex items-center gap-2 font-normal cursor-pointer">
                <HardDrive className="h-4 w-4" />
                Local (Mac Mini M4)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cloud" id="cloud" />
              <Label htmlFor="cloud" className="flex items-center gap-2 font-normal cursor-pointer">
                <Cloud className="h-4 w-4" />
                Cloud (Ollama.com)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_key">Clé API Ollama *</Label>
          <Input
            id="api_key"
            type="password"
            placeholder="Collez votre clé API ici"
            value={config.api_key_encrypted}
            onChange={(e) => setConfig({ ...config, api_key_encrypted: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            {isCloudMode 
              ? "Créez une clé sur ollama.com/settings/keys"
              : "Cette clé sera utilisée pour authentifier les requêtes"
            }
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Modèle par défaut</Label>
          <Select 
            value={selectedModel} 
            onValueChange={setSelectedModel}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.available_models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isCloudMode && (
          <Collapsible open={advancedMode} onOpenChange={setAdvancedMode}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration avancée (optionnelle)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="ollama_url">URL personnalisée</Label>
                <Input
                  id="ollama_url"
                  placeholder="http://localhost:11434"
                  value={config.ollama_url}
                  onChange={(e) => setConfig({ ...config, ollama_url: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Par défaut : http://localhost:11434 (modifiez uniquement si nécessaire)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={config.is_active}
            onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
          />
          <Label htmlFor="is_active">Activer Ollama {isCloudMode ? 'Cloud' : 'Local'}</Label>
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

        {isCloudMode && (
          <Card className="border-2 border-gray-700 bg-black text-white">
            <CardHeader>
              <CardTitle className="text-lg">🔍 Test Web Search</CardTitle>
              <CardDescription>
                Testez la recherche web d'Ollama Cloud avec un prompt personnalisé
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_prompt">Prompt de test</Label>
                <Input
                  id="test_prompt"
                  placeholder="Ex: Quel est le prix moyen des iPhone 15 en France ?"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                />
              </div>
              
              <Button
                onClick={testWebSearch}
                disabled={isTestingWebSearch}
                className="w-full"
              >
                <TestTube className="w-4 h-4 mr-2" />
                {isTestingWebSearch ? "Recherche en cours..." : "Lancer la recherche web"}
              </Button>

              {webSearchResults && (
                <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <h4 className="font-semibold mb-2">Résultat :</h4>
                  <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                    {JSON.stringify(webSearchResults, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
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
            variant="outline"
            onClick={syncToProviders}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Synchroniser
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