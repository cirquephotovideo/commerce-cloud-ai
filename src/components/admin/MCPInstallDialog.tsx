import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { MCPLibrary } from "@/lib/mcpLibraries";
import { MCPToolsTab } from "./MCPToolsTab";
import { MCPUseCasesTab } from "./MCPUseCasesTab";

interface MCPInstallDialogProps {
  library: MCPLibrary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallComplete: () => void;
}

export function MCPInstallDialog({ library, open, onOpenChange, onInstallComplete }: MCPInstallDialogProps) {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const [versionInfo, setVersionInfo] = useState({
    client: library?.version || '',
    server: null as string | null,
    compatible: null as boolean | null
  });

  if (!library) return null;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(library.installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Commande copiée");
  };

  const handleEnvVarChange = (key: string, value: string) => {
    setEnvVars(prev => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Simuler un test de connexion
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Vérifier que toutes les variables requises sont remplies
      const missingVars = library.requiredEnvVars.filter(v => !envVars[v]);
      if (missingVars.length > 0) {
        throw new Error(`Variables manquantes: ${missingVars.join(', ')}`);
      }

      // Simuler la détection de version serveur
      const detectedServerVersion = library.version; // En réalité, cela serait récupéré du serveur
      const compatible = detectedServerVersion === library.version;
      
      setVersionInfo({
        client: library.version,
        server: detectedServerVersion,
        compatible: compatible
      });

      setTestResult('success');
      toast.success("Connexion réussie !");
    } catch (error) {
      setTestResult('error');
      toast.error(error instanceof Error ? error.message : "Échec du test");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Sauvegarder la configuration dans platform_configurations
      const { error } = await supabase.from('platform_configurations').insert({
        user_id: user.id,
        platform_type: library.id,
        platform_url: library.defaultConfig.server_url || library.npmPackage,
        is_active: true,
        additional_config: {
          npm_package: library.npmPackage,
          version: library.version,
          auth_type: library.defaultConfig.auth_type,
          credentials: envVars
        },
        mcp_version_client: versionInfo.client,
        mcp_version_server: versionInfo.server,
        mcp_chat_enabled: true,
        mcp_allowed_tools: []
      });

      if (error) throw error;

      toast.success(`${library.name} activé avec succès !`);
      onInstallComplete();
      onOpenChange(false);
      
      // Reset
      setEnvVars({});
      setTestResult(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <span className="text-3xl">{library.icon}</span>
            Installer {library.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="tools">Fonctionnalités</TabsTrigger>
            <TabsTrigger value="usecases">Cas d'Usage</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="info" className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{library.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Installation</h3>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
                  <code className="flex-1 text-sm font-mono">{library.installCommand}</code>
                  <Button size="sm" variant="ghost" onClick={handleCopyCommand}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Instructions de configuration</h3>
                <pre className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {library.setupInstructions}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Informations</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Package:</span>
                    <code className="font-mono">{library.npmPackage}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <Badge variant="outline">v{library.version}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Catégorie:</span>
                    <Badge>{library.category}</Badge>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(library.documentation, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Documentation officielle
              </Button>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              {library.requiredEnvVars.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Cette librairie ne nécessite aucune configuration supplémentaire.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert>
                    <AlertDescription>
                      Configurez les variables d'environnement requises pour {library.name}.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    {library.requiredEnvVars.map(envVar => (
                      <div key={envVar} className="space-y-2">
                        <Label htmlFor={envVar}>{envVar}</Label>
                        <Input
                          id={envVar}
                          type="password"
                          placeholder={`Entrez ${envVar}`}
                          value={envVars[envVar] || ''}
                          onChange={(e) => handleEnvVarChange(envVar, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="tools" className="space-y-4">
              <MCPToolsTab library={library} />
            </TabsContent>

            <TabsContent value="usecases" className="space-y-4">
              <MCPUseCasesTab library={library} />
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <Alert>
                <AlertDescription>
                  Testez la connexion à {library.name} avant d'activer le service.
                </AlertDescription>
              </Alert>

              {versionInfo.server && (
                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm">Informations de Version</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Version Client:</span>
                      <Badge variant="outline" className="ml-2">{versionInfo.client}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Version Serveur:</span>
                      <Badge variant="outline" className="ml-2">{versionInfo.server}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground">Compatibilité:</span>
                    {versionInfo.compatible ? (
                      <Badge className="bg-green-500">✅ Compatible</Badge>
                    ) : (
                      <Badge variant="destructive">⚠️ Versions différentes</Badge>
                    )}
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleTestConnection}
                disabled={testing || library.requiredEnvVars.some(v => !envVars[v])}
              >
                {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Tester la Connexion
              </Button>

              {testResult && (
                <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
                  <div className="flex items-center gap-2">
                    {testResult === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult === 'success' 
                        ? 'Connexion réussie ! Vous pouvez maintenant activer le service.'
                        : 'Échec du test. Vérifiez vos credentials.'}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSaveAndActivate}
            disabled={saving || (library.requiredEnvVars.length > 0 && testResult !== 'success')}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sauvegarder et Activer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
