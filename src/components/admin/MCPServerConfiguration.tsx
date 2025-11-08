import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Server, TestTube, Plug, Zap, ChevronDown, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { MCPInstallationGuide } from "./MCPInstallationGuide";

export const MCPServerConfiguration = () => {
  const [config, setConfig] = useState({
    server_url: "",
    api_key: "",
    server_name: "",
    is_active: false,
    available_models: [] as string[]
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [openSections, setOpenSections] = useState({
    installation: false,
    configuration: true,
    models: false
  });

  // Charger la configuration existante
  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("ai_provider_configs")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("provider", "mcp")
        .single();

      if (data && !error) {
        setConfig({
          server_url: data.api_url || "",
          api_key: data.api_key_encrypted || "",
          server_name: data.default_model || "",
          is_active: data.is_active || false,
          available_models: []
        });
        setConnectionStatus(data.is_active ? 'connected' : 'disconnected');
        console.log('[MCP] Configuration chargée:', data);
      }
    } catch (error) {
      console.error('[MCP] Erreur lors du chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testMCPConnection = async () => {
    if (!config.server_url) {
      toast.error("URL du serveur MCP requise");
      return;
    }

    // Valider le format de l'URL
    try {
      new URL(config.server_url);
    } catch {
      toast.error("Format d'URL invalide");
      return;
    }

    setIsTesting(true);
    setConnectionStatus('disconnected');
    const startTime = Date.now();

    try {
      console.log('[MCP] Test de connexion à:', config.server_url);
      
      // Tester la connexion au serveur MCP
      const response = await fetch(`${config.server_url}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': config.api_key ? `Bearer ${config.api_key}` : '',
          'Content-Type': 'application/json'
        }
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.data?.map((m: any) => m.id) || [];
      
      setConfig(prev => ({ ...prev, available_models: models }));
      setConnectionStatus('connected');
      setOpenSections(prev => ({ ...prev, models: true }));
      
      toast.success(`✅ Connexion réussie ! ${models.length} modèles trouvés (${latency}ms)`);
      console.log('[MCP] Modèles disponibles:', models);
    } catch (error) {
      console.error("[MCP] Erreur de connexion:", error);
      setConnectionStatus('error');
      toast.error(`❌ Connexion échouée: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const saveMCPConfig = async () => {
    if (!config.server_url || !config.server_name) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Vous devez être connecté");
        return;
      }

      console.log('[MCP] Sauvegarde de la configuration...');

      // Sauvegarder dans ai_provider_configs avec provider='mcp'
      const { error } = await supabase
        .from("ai_provider_configs")
        .upsert({
          user_id: session.user.id,
          provider: 'mcp',
          api_key_encrypted: config.api_key,
          api_url: config.server_url,
          default_model: config.server_name,
          is_active: connectionStatus === 'connected',
          priority: 3
        }, { onConflict: 'user_id,provider' });

      if (error) throw error;

      toast.success("✅ Configuration sauvegardée avec succès");
      console.log('[MCP] Configuration sauvegardée');
    } catch (error) {
      console.error("[MCP] Erreur de sauvegarde:", error);
      toast.error(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            <CardTitle>Serveur MCP (Model Context Protocol)</CardTitle>
          </div>
          {connectionStatus === 'connected' && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connecté
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Erreur
            </Badge>
          )}
        </div>
        <CardDescription>
          Connectez un serveur MCP interne pour utiliser des modèles personnalisés
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section Installation */}
        <Collapsible
          open={openSections.installation}
          onOpenChange={(open) => setOpenSections(prev => ({ ...prev, installation: open }))}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="font-semibold">Guide d'Installation</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.installation ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <MCPInstallationGuide />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Section Configuration */}
        <Collapsible
          open={openSections.configuration}
          onOpenChange={(open) => setOpenSections(prev => ({ ...prev, configuration: open }))}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                <span className="font-semibold">Configuration</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.configuration ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Configurez votre serveur MCP pour utiliser vos propres modèles IA
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="mcp_server_name">
                  Nom du serveur <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mcp_server_name"
                  placeholder="Serveur IA Interne"
                  value={config.server_name}
                  onChange={(e) => setConfig({ ...config, server_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcp_server_url">
                  URL du serveur MCP <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mcp_server_url"
                  placeholder="http://localhost:11434"
                  value={config.server_url}
                  onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Ollama: http://localhost:11434 | LocalAI: http://localhost:8080 | LM Studio: http://localhost:1234
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mcp_api_key">Clé API (optionnelle)</Label>
                <div className="flex gap-2">
                  <Input
                    id="mcp_api_key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Clé d'authentification si nécessaire"
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Section Modèles disponibles */}
        {config.available_models.length > 0 && (
          <>
            <Collapsible
              open={openSections.models}
              onOpenChange={(open) => setOpenSections(prev => ({ ...prev, models: open }))}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-semibold">Modèles Disponibles</span>
                    <Badge variant="secondary">{config.available_models.length}</Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.models ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  {config.available_models.map((model) => (
                    <Badge key={model} variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {model}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Separator />
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testMCPConnection}
            disabled={isTesting || !config.server_url}
            className="flex-1"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Tester la Connexion
              </>
            )}
          </Button>
          
          <Button 
            onClick={saveMCPConfig}
            disabled={!config.server_url || !config.server_name}
            className="flex-1"
          >
            Sauvegarder
          </Button>
        </div>

        {/* Statut */}
        {connectionStatus !== 'disconnected' && (
          <Alert variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {connectionStatus === 'connected'
                ? `Serveur connecté avec succès • ${config.available_models.length} modèles disponibles`
                : 'Impossible de se connecter au serveur. Vérifiez l\'URL et réessayez.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};