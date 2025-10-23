import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Activity, RefreshCw, Download, ArrowUpDown, Save, Loader2, ChevronDown } from "lucide-react";
import { useAIProvider, AIProvider } from "@/hooks/useAIProvider";
import { ProviderSelector } from "./admin/ProviderSelector";
import { ImportExportButtons } from "./admin/ImportExportButtons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [recentLogs, setRecentLogs] = useState<AIRequestLog[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; success: number }>>({});
  const [fallbackOrder, setFallbackOrder] = useState<AIProvider[]>([
    'lovable', 'claude', 'openai', 'openrouter', 'ollama_cloud', 'ollama_local'
  ]);
  const [userPreferences, setUserPreferences] = useState<any[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Collapsible states
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [monitoringOpen, setMonitoringOpen] = useState(false);

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
      const { data: existing } = await supabase
        .from('user_provider_preferences')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
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
    toast({
      title: "Configuration",
      description: `Configurer ${provider} dans l'onglet API Keys`,
    });
  };

  const getStatusBadge = (provider: AIProvider) => {
    if (provider === 'lovable') {
      return <Badge variant="default">🟢 Online</Badge>;
    }

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

  const providerIcons: Record<AIProvider, string> = {
    'lovable': '🚀',
    'claude': '🤖',
    'openai': '🔥',
    'openrouter': '🌐',
    'ollama_cloud': '☁️',
    'ollama_local': '💻',
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Fournisseurs IA</h2>
          <p className="text-sm text-muted-foreground">
            Configurez vos fournisseurs IA et gérez les priorités
          </p>
        </div>
        <ImportExportButtons
          data={{ providers: providerConfigs, user_preferences: userPreferences }}
          filename="ai-providers"
          onImport={handleImport}
        />
      </div>

      {/* Current Provider Summary Card - Always Visible */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Provider IA Principal
          </CardTitle>
          <CardDescription className="text-xs">
            Provider actuellement utilisé pour toutes les requêtes IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-background border-2 border-primary">
            <div className="flex items-center gap-4">
              <div className="text-4xl">
                {providerIcons[currentProvider]}
              </div>
              <div>
                <div className="font-bold text-xl">{providerNames[currentProvider]}</div>
                <div className="text-sm text-muted-foreground">Provider actif</div>
              </div>
            </div>
            <div className="self-start sm:self-auto">
              {getStatusBadge(currentProvider)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Selection - Collapsible */}
      <Collapsible open={selectionOpen} onOpenChange={setSelectionOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">🎯 Sélection du Provider</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${selectionOpen ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription className="text-xs">
                Choisissez le provider IA principal pour vos enrichissements
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <ProviderSelector
                selected={currentProvider}
                onSelect={updateProvider}
                onConfigure={handleConfigureProvider}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Fallback Configuration - Collapsible */}
      <Collapsible open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">🔄 Configuration Fallback</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${fallbackOpen ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription className="text-xs">
                Définissez l'ordre de priorité en cas d'échec du provider principal
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{index + 1}️⃣</span>
                        <span className="font-medium">{providerNames[provider]}</span>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Monitoring & Logs - Collapsible */}
      <Collapsible open={monitoringOpen} onOpenChange={setMonitoringOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <CardTitle className="text-lg">Monitoring & Logs</CardTitle>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${monitoringOpen ? 'rotate-180' : ''}`} />
              </div>
              <CardDescription className="text-xs">
                Statistiques d'utilisation (7 derniers jours)
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {log.success ? '✅' : '❌'}
                          <span className="font-medium text-sm">{new Date(log.created_at).toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-xs">{providerNames[log.provider]}</Badge>
                        </div>
                        {log.latency_ms && (
                          <span className="text-sm text-muted-foreground">{log.latency_ms}ms</span>
                        )}
                      </div>
                      {log.model && (
                        <p className="text-xs text-muted-foreground mt-1">model: {log.model}</p>
                      )}
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1 break-all">error: {log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
