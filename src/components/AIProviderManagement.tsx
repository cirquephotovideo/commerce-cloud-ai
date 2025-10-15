import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Activity, TestTube, RefreshCw, Download, ArrowUpDown, Save, Loader2 } from "lucide-react";
import { useAIProvider, AIProvider } from "@/hooks/useAIProvider";
import { ProviderSelector } from "./admin/ProviderSelector";
import { ImportExportButtons } from "./admin/ImportExportButtons";
import { useOllamaHealth } from "@/hooks/useOllamaHealth";

type ProviderStatus = 'online' | 'offline' | 'degraded';

interface ProviderHealth {
  provider: AIProvider;
  status: ProviderStatus;
  response_time_ms: number | null;
  last_check: string;
  available_models: any;
  error_details: any;
}

interface AIRequestLog {
  id: string;
  provider: AIProvider;
  model: string | null;
  success: boolean;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export default function AIProviderManagement() {
  const { toast } = useToast();
  const { provider: currentProvider, updateProvider, fallbackEnabled, updateFallback } = useAIProvider();
  
  const [activeTab, setActiveTab] = useState<string>("selector");
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [recentLogs, setRecentLogs] = useState<AIRequestLog[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; success: number }>>({});
  const [fallbackOrder, setFallbackOrder] = useState<AIProvider[]>([
    'lovable', 'claude', 'openai', 'openrouter', 'ollama_cloud', 'ollama_local'
  ]);
  const [userPreferences, setUserPreferences] = useState<any[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProviderHealth();
    loadRecentLogs();
    loadStats();
    loadFallbackOrder();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: prefs } = await supabase
      .from('user_provider_preferences')
      .select('*')
      .eq('user_id', session.user.id);
    
    const { data: configs } = await supabase
      .from('ai_provider_configs')
      .select('*');

    if (prefs) setUserPreferences(prefs);
    if (configs) setProviderConfigs(configs);
  };

  const loadProviderHealth = async () => {
    const { data } = await supabase
      .from('ai_provider_health')
      .select('*')
      .order('last_check', { ascending: false });
    
    if (data) setProviderHealth(data as ProviderHealth[]);
  };

  const loadRecentLogs = async () => {
    const { data } = await supabase
      .from('ai_request_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setRecentLogs(data as AIRequestLog[]);
  };

  const loadStats = async () => {
    const { data } = await supabase
      .from('ai_request_logs')
      .select('provider, success')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    if (data) {
      const statsMap: Record<string, { total: number; success: number }> = {};
      data.forEach((log: any) => {
        if (!statsMap[log.provider]) {
          statsMap[log.provider] = { total: 0, success: 0 };
        }
        statsMap[log.provider].total++;
        if (log.success) statsMap[log.provider].success++;
      });
      setStats(statsMap);
    }
  };

  const loadFallbackOrder = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from('user_provider_preferences')
      .select('fallback_order')
      .eq('user_id', session.user.id)
      .single();

    if (data?.fallback_order) {
      setFallbackOrder(data.fallback_order as AIProvider[]);
    }
  };

  const saveFallbackOrder = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    if (!currentProvider) {
      toast({
        title: "❌ Erreur",
        description: "Sélectionnez un provider principal",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Vérifier si un enregistrement existe
      const { data: existing } = await supabase
        .from('user_provider_preferences')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        // UPDATE
        const { error } = await supabase
          .from('user_provider_preferences')
          .update({
            primary_provider: currentProvider,
            fallback_order: fallbackOrder,
            fallback_enabled: fallbackEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', session.user.id);

        if (error) throw error;
      } else {
        // INSERT
        const { error } = await supabase
          .from('user_provider_preferences')
          .insert({
            user_id: session.user.id,
            primary_provider: currentProvider,
            fallback_order: fallbackOrder,
            fallback_enabled: fallbackEnabled,
          });

        if (error) throw error;
      }

      toast({
        title: "✅ Sauvegardé",
        description: "Ordre de fallback mis à jour",
      });

      // Recharger
      await Promise.all([
        loadConfig(),
        loadFallbackOrder(),
        loadProviderHealth(),
      ]);
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de sauvegarder",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const moveProvider = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...fallbackOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setFallbackOrder(newOrder);
  };

  const handleConfigureProvider = (provider: AIProvider) => {
    // Navigate to the API Keys tab
    const tabMap: Record<AIProvider, string> = {
      'lovable': 'selector',
      'claude': 'selector',
      'openai': 'selector',
      'openrouter': 'selector',
      'ollama_cloud': 'selector',
      'ollama_local': 'selector',
    };
    setActiveTab(tabMap[provider]);
    
    toast({
      title: "Configuration",
      description: `Veuillez configurer ${provider} dans l'onglet "API Keys" (accessible depuis le menu Administration)`,
    });
  };

  const { data: ollamaHealthData } = useOllamaHealth();

  const getStatusBadge = (provider: AIProvider) => {
    // Lovable AI toujours en ligne
    if (provider === 'lovable') {
      return (
        <Badge variant="default">
          🟢 Online
        </Badge>
      );
    }

    // Pour Ollama, lire depuis provider='ollama' dans la DB
    if (provider === 'ollama_cloud' || provider === 'ollama_local') {
      const ollamaHealth = providerHealth.find(h => h.provider === 'ollama' as any);
      const hasConfig = providerConfigs.find(c => c.provider === 'ollama' as any && c.api_key_encrypted);
      
      if (!ollamaHealth && !hasConfig) {
        return <Badge variant="secondary">Non configuré</Badge>;
      }
      
      if (ollamaHealth) {
        const variants: Record<ProviderStatus, "default" | "destructive" | "secondary"> = {
          online: "default",
          offline: "destructive",
          degraded: "secondary"
        };

        return (
          <Badge variant={variants[ollamaHealth.status]}>
            {ollamaHealth.status === 'online' && '🟢'}
            {ollamaHealth.status === 'offline' && '🔴'}
            {ollamaHealth.status === 'degraded' && '🟡'}
            {' '}
            {ollamaHealth.status}
            {ollamaHealth.response_time_ms && ` (${ollamaHealth.response_time_ms}ms)`}
          </Badge>
        );
      }
    }

    // Pour les autres providers, utiliser providerHealth
    const health = providerHealth.find(h => h.provider === provider);
    if (!health) return <Badge variant="secondary">Non configuré</Badge>;

    const variants: Record<ProviderStatus, "default" | "destructive" | "secondary"> = {
      online: "default",
      offline: "destructive",
      degraded: "secondary"
    };

    return (
      <Badge variant={variants[health.status]}>
        {health.status === 'online' && '🟢'}
        {health.status === 'offline' && '🔴'}
        {health.status === 'degraded' && '🟡'}
        {' '}
        {health.status}
        {health.response_time_ms && ` (${health.response_time_ms}ms)`}
      </Badge>
    );
  };

  const exportLogs = async () => {
    const csv = [
      ['Date', 'Provider', 'Model', 'Success', 'Latency', 'Error'].join(','),
      ...recentLogs.map(log => 
        [
          new Date(log.created_at).toLocaleString(),
          log.provider,
          log.model || 'N/A',
          log.success,
          log.latency_ms || 'N/A',
          log.error_message || ''
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  const providerNames: Record<AIProvider, string> = {
    'lovable': 'Lovable AI',
    'claude': 'Claude',
    'openai': 'OpenAI',
    'openrouter': 'OpenRouter',
    'ollama_cloud': 'Ollama Cloud',
    'ollama_local': 'Ollama Local',
  };

  const handleImport = async (data: any) => {
    if (!data.providers || !Array.isArray(data.providers)) {
      throw new Error('Format invalide: providers attendu');
    }

    for (const provider of data.providers) {
      const { error } = await supabase.from('ai_provider_configs').upsert(provider);
      if (error) throw error;
    }

    if (data.user_preferences && Array.isArray(data.user_preferences)) {
      for (const pref of data.user_preferences) {
        const { error } = await supabase.from('user_provider_preferences').upsert(pref);
        if (error) throw error;
      }
    }

    await loadConfig();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Fournisseurs IA</h2>
          <p className="text-muted-foreground">
            Configurez vos fournisseurs IA et gérez les priorités
          </p>
        </div>
        <ImportExportButtons
          data={{ providers: providerConfigs, user_preferences: userPreferences }}
          filename="ai-providers"
          onImport={handleImport}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="selector" className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              🎯 <span className="font-semibold">Sélection</span>
            </div>
            <span className="text-xs text-muted-foreground">Choisir le provider principal</span>
          </TabsTrigger>
          <TabsTrigger value="fallback" className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              🔄 <span className="font-semibold">Fallback</span>
            </div>
            <span className="text-xs text-muted-foreground">Ordre de secours</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="font-semibold">Monitoring</span>
            </div>
            <span className="text-xs text-muted-foreground">Statistiques et logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="selector" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🎯 Sélectionnez votre Provider IA Principal</CardTitle>
              <CardDescription>
                Cliquez sur un provider pour le sélectionner comme principal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProviderSelector
                selected={currentProvider}
                onSelect={updateProvider}
                onConfigure={handleConfigureProvider}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fallback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🔄 Configuration du Fallback Automatique</CardTitle>
              <CardDescription>
                Définissez l'ordre de priorité en cas d'échec du provider principal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={fallbackEnabled}
                    onCheckedChange={updateFallback}
                  />
                  <Label>Activer le fallback automatique</Label>
                </div>
                {fallbackEnabled && (
                  <Badge variant="default">Activé</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>Ordre d'essai en cas d'échec</Label>
                <div className="space-y-2">
                  {fallbackOrder.map((provider, index) => (
                    <div
                      key={provider}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{index + 1}️⃣</span>
                        <span className="font-medium">{providerNames[provider]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(provider)}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveProvider(index, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUpDown className="h-4 w-4 rotate-180" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveProvider(index, 'down')}
                            disabled={index === fallbackOrder.length - 1}
                          >
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={saveFallbackOrder} 
                className="w-full gap-2"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Sauvegarder l'Ordre
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📊 Logs & Monitoring</CardTitle>
              <CardDescription>Statistiques d'utilisation (7 derniers jours)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(stats).map(([provider, data]) => (
                  <Card key={provider}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{providerNames[provider as AIProvider]}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{data.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {data.total > 0 ? Math.round((data.success / data.total) * 100) : 0}% succès
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Dernières requêtes</Label>
                  <div className="flex gap-2">
                    <Button onClick={exportLogs} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </Button>
                    <Button onClick={loadRecentLogs} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Actualiser
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {recentLogs.map(log => (
                    <div key={log.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.success ? '✅' : '❌'}
                          <span className="font-medium">{new Date(log.created_at).toLocaleTimeString()}</span>
                          <Badge variant="outline">{providerNames[log.provider]}</Badge>
                        </div>
                        {log.latency_ms && (
                          <span className="text-sm text-muted-foreground">{log.latency_ms}ms</span>
                        )}
                      </div>
                      {log.model && (
                        <p className="text-sm text-muted-foreground mt-1">model: {log.model}</p>
                      )}
                      {log.error_message && (
                        <p className="text-sm text-destructive mt-1">error: {log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Carte Provider IA Principal - Résumé du choix */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Provider IA Principal Sélectionné
          </CardTitle>
          <CardDescription>
            Ce provider est actuellement utilisé pour toutes les requêtes IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
            <div className="flex items-center gap-4">
              <div className="text-4xl">
                {(() => {
                  const providerIcons: Record<AIProvider, string> = {
                    'lovable': '🚀',
                    'claude': '🤖',
                    'openai': '🔥',
                    'openrouter': '🌐',
                    'ollama_cloud': '☁️',
                    'ollama_local': '💻',
                  };
                  return providerIcons[currentProvider];
                })()}
              </div>
              <div>
                <div className="font-bold text-xl">{providerNames[currentProvider]}</div>
                <div className="text-sm text-muted-foreground">Provider actif</div>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(currentProvider)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
