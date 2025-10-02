import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AIProvider = 'lovable' | 'ollama';

interface OllamaConfig {
  ollama_url: string;
  api_key_encrypted: string;
  available_models: string[];
  is_active: boolean;
}

export const AIProviderSettings = () => {
  const { toast } = useToast();
  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>({
    ollama_url: '',
    api_key_encrypted: '',
    available_models: [],
    is_active: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch AI preferences
      const { data: prefData } = await supabase
        .from("user_ai_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (prefData) {
        setProvider(prefData.preferred_provider as AIProvider);
        setFallbackEnabled(prefData.fallback_enabled);
      }

      // Fetch Ollama configuration
      const { data: ollamaData } = await supabase
        .from("ollama_configurations")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (ollamaData) {
        const models = Array.isArray(ollamaData.available_models) 
          ? (ollamaData.available_models as any[]).map(String)
          : [];
        
        setOllamaConfig({
          ollama_url: ollamaData.ollama_url,
          api_key_encrypted: ollamaData.api_key_encrypted || '',
          available_models: models,
          is_active: ollamaData.is_active,
        });
        if (ollamaData.is_active && models.length > 0) {
          setConnectionStatus('connected');
        }
      }
    } catch (error) {
      console.error("Error fetching configurations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProvider = async (newProvider: AIProvider) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("user_ai_preferences")
        .upsert({
          user_id: session.user.id,
          preferred_provider: newProvider,
          fallback_enabled: fallbackEnabled,
        });

      if (error) throw error;

      setProvider(newProvider);
      toast({
        title: "Succès",
        description: `Provider changé vers ${newProvider === 'lovable' ? 'Lovable AI' : 'Ollama Cloud'}`,
      });
    } catch (error) {
      console.error("Error updating provider:", error);
      toast({
        title: "Erreur",
        description: "Impossible de changer le provider",
        variant: "destructive",
      });
    }
  };

  const testConnection = async () => {
    if (!ollamaConfig.ollama_url) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une URL Ollama",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke("ollama-proxy", {
        body: {
          action: "test",
          ollama_url: ollamaConfig.ollama_url,
          api_key: ollamaConfig.api_key_encrypted,
        },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('connected');
        setOllamaConfig(prev => ({
          ...prev,
          available_models: data.models || [],
        }));
        toast({
          title: "Connexion réussie",
          description: `${data.models?.length || 0} modèle(s) disponible(s)`,
        });
      } else {
        throw new Error(data.error || "Test de connexion échoué");
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("ollama_configurations")
        .upsert({
          user_id: session.user.id,
          ollama_url: ollamaConfig.ollama_url,
          api_key_encrypted: ollamaConfig.api_key_encrypted,
          available_models: ollamaConfig.available_models,
          is_active: ollamaConfig.is_active,
        });

      if (error) throw error;

      toast({
        title: "Configuration sauvegardée",
        description: "Vos paramètres Ollama ont été enregistrés",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuration IA</CardTitle>
            <CardDescription>Gérez vos providers d'intelligence artificielle</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configurer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configuration des Providers IA</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="provider" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="provider">Provider</TabsTrigger>
                  <TabsTrigger value="ollama">Ollama Cloud</TabsTrigger>
                </TabsList>

                <TabsContent value="provider" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Provider IA par défaut</Label>
                      <Select value={provider} onValueChange={(v) => updateProvider(v as AIProvider)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lovable">🚀 Lovable AI (Recommandé)</SelectItem>
                          <SelectItem value="ollama">💻 Ollama Cloud</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {provider === 'lovable' 
                          ? "Utilise les modèles IA hébergés par Lovable"
                          : "Utilise votre instance Ollama Cloud ou locale"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Fallback automatique</Label>
                        <p className="text-sm text-muted-foreground">
                          Basculer vers Lovable AI en cas d'échec
                        </p>
                      </div>
                      <Switch
                        checked={fallbackEnabled}
                        onCheckedChange={setFallbackEnabled}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ollama" className="space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ollama-url">URL Ollama</Label>
                          <Input
                            id="ollama-url"
                            placeholder="http://localhost:11434 ou https://your-cloud-instance.com"
                            value={ollamaConfig.ollama_url}
                            onChange={(e) => setOllamaConfig(prev => ({ ...prev, ollama_url: e.target.value }))}
                          />
                          <p className="text-sm text-muted-foreground">
                            URL de votre instance Ollama (locale ou cloud)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ollama-api-key">Clé API (optionnel)</Label>
                          <Input
                            id="ollama-api-key"
                            type="password"
                            placeholder="Votre clé API Ollama"
                            value={ollamaConfig.api_key_encrypted}
                            onChange={(e) => setOllamaConfig(prev => ({ ...prev, api_key_encrypted: e.target.value }))}
                          />
                          <p className="text-sm text-muted-foreground">
                            Nécessaire uniquement pour les instances sécurisées
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Service actif</Label>
                            <p className="text-sm text-muted-foreground">
                              Activer l'utilisation d'Ollama
                            </p>
                          </div>
                          <Switch
                            checked={ollamaConfig.is_active}
                            onCheckedChange={(checked) => setOllamaConfig(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={testConnection}
                            disabled={isTesting || !ollamaConfig.ollama_url}
                            variant="outline"
                            className="flex-1"
                          >
                            {isTesting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Test en cours...
                              </>
                            ) : (
                              "Tester la connexion"
                            )}
                          </Button>
                          {connectionStatus !== 'idle' && (
                            <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                              {connectionStatus === 'connected' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </Badge>
                          )}
                        </div>

                        {ollamaConfig.available_models.length > 0 && (
                          <div className="space-y-2">
                            <Label>Modèles disponibles</Label>
                            <div className="flex flex-wrap gap-2">
                              {ollamaConfig.available_models.map((model, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {model}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={saveConfiguration} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sauvegarde...
                            </>
                          ) : (
                            "Sauvegarder"
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Provider actuel</p>
              <p className="text-sm text-muted-foreground">
                {provider === 'lovable' ? '🚀 Lovable AI' : '💻 Ollama Cloud'}
              </p>
            </div>
            {provider === 'ollama' && (
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
                {connectionStatus === 'connected' ? 'Connecté' : 'Non configuré'}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
