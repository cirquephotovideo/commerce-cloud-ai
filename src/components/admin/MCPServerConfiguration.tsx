import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Server, TestTube, Plug, Zap } from "lucide-react";

export const MCPServerConfiguration = () => {
  const [config, setConfig] = useState({
    server_url: "",
    api_key: "",
    server_name: "",
    is_active: false,
    available_models: [] as string[]
  });
  const [isTesting, setIsTesting] = useState(false);

  const testMCPConnection = async () => {
    if (!config.server_url) {
      toast.error("URL du serveur MCP requise");
      return;
    }

    setIsTesting(true);
    try {
      // Tester la connexion au serveur MCP
      const response = await fetch(`${config.server_url}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': config.api_key ? `Bearer ${config.api_key}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const models = data.data?.map((m: any) => m.id) || [];
      
      setConfig(prev => ({ ...prev, available_models: models }));
      toast.success(`✅ Connexion MCP réussie ! ${models.length} modèles trouvés`);
    } catch (error) {
      console.error("MCP test error:", error);
      toast.error("❌ Impossible de se connecter au serveur MCP");
    } finally {
      setIsTesting(false);
    }
  };

  const saveMCPConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Sauvegarder dans ai_provider_configs avec provider='mcp'
      const { error } = await supabase
        .from("ai_provider_configs")
        .upsert({
          user_id: session.user.id,
          provider: 'mcp',
          api_key_encrypted: config.api_key,
          api_url: config.server_url,
          default_model: config.server_name,
          is_active: config.is_active,
          priority: 3
        }, { onConflict: 'user_id,provider' });

      if (error) throw error;

      toast.success("✅ Serveur MCP configuré");
    } catch (error) {
      console.error("Error saving MCP config:", error);
      toast.error("❌ Erreur lors de la sauvegarde");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <CardTitle>Serveur MCP (Model Context Protocol)</CardTitle>
        </div>
        <CardDescription>
          Connectez un serveur MCP interne pour utiliser des modèles personnalisés
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mcp_server_name">Nom du serveur</Label>
          <Input
            id="mcp_server_name"
            placeholder="Serveur IA Interne"
            value={config.server_name}
            onChange={(e) => setConfig({ ...config, server_name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mcp_server_url">URL du serveur MCP</Label>
          <Input
            id="mcp_server_url"
            placeholder="http://192.168.1.100:8080"
            value={config.server_url}
            onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Exemple : http://localhost:8080 ou http://192.168.1.100:8080
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mcp_api_key">Clé API (optionnelle)</Label>
          <Input
            id="mcp_api_key"
            type="password"
            placeholder="Clé d'authentification si nécessaire"
            value={config.api_key}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
          />
        </div>

        {config.available_models.length > 0 && (
          <div className="space-y-2">
            <Label>Modèles Disponibles</Label>
            <div className="flex flex-wrap gap-2">
              {config.available_models.map((model) => (
                <Badge key={model} variant="secondary">
                  <Zap className="h-3 w-3 mr-1" />
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testMCPConnection}
            disabled={isTesting}
          >
            <TestTube className="w-4 h-4 mr-2" />
            {isTesting ? "Test en cours..." : "Tester la Connexion"}
          </Button>
          
          <Button onClick={saveMCPConfig}>
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};