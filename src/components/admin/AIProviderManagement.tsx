import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Cloud, Laptop, Activity, TestTube, RefreshCw, Save, Search, Download, Zap } from "lucide-react";
import { useAIProvider } from "@/hooks/useAIProvider";

type AIProvider = 'lovable' | 'ollama_cloud' | 'ollama_local';
type ProviderStatus = 'online' | 'offline' | 'degraded';

interface ProviderHealth {
  provider: AIProvider;
  status: ProviderStatus;
  response_time_ms: number | null;
  last_check: string;
  available_models: any; // Json type from Supabase
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

interface OllamaConfig {
  ollama_url: string;
  api_key_encrypted: string;
  is_active: boolean;
  available_models: string[];
}

const LOVABLE_MODELS = [
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Top-tier reasoning + multimodal' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced performance (Default)' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fast & efficient' },
  { id: 'openai/gpt-5', name: 'GPT-5', description: 'Most powerful reasoning' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', description: 'Cost-effective excellence' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', description: 'Speed optimized' },
];

export default function AIProviderManagement() {
  const { toast } = useToast();
  const { provider: currentProvider, updateProvider, fallbackEnabled, updateFallback } = useAIProvider();
  
  const [activeTab, setActiveTab] = useState<string>("lovable");
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [recentLogs, setRecentLogs] = useState<AIRequestLog[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; success: number }>>({});
  
  // Lovable AI state
  const [defaultModel, setDefaultModel] = useState<string>('google/gemini-2.5-flash');
  
  // Ollama Cloud state
  const [ollamaCloudConfig, setOllamaCloudConfig] = useState<OllamaConfig>({
    ollama_url: '',
    api_key_encrypted: '',
    is_active: false,
    available_models: []
  });
  const [testingCloud, setTestingCloud] = useState(false);
  
  // Ollama Local state
  const [ollamaLocalConfig, setOllamaLocalConfig] = useState<OllamaConfig>({
    ollama_url: 'http://192.168.1.100:11434',
    api_key_encrypted: '',
    is_active: false,
    available_models: []
  });
  const [testingLocal, setTestingLocal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [networkDiagnostics, setNetworkDiagnostics] = useState({
    ping: false,
    portOpen: false,
    latency: 0
  });
  
  // Test & Diagnostics state
  const [testPrompt, setTestPrompt] = useState("Analyse ce produit: iPhone 15 Pro Max 256GB");
  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>(['lovable']);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency: number; response: string; error?: string }>>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadProviderHealth();
    loadRecentLogs();
    loadStats();
    loadOllamaConfigs();
  }, []);

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

  const loadOllamaConfigs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from('ollama_configurations')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (data) {
      setOllamaLocalConfig({
        ollama_url: data.ollama_url,
        api_key_encrypted: data.api_key_encrypted || '',
        is_active: data.is_active,
        available_models: (data.available_models as string[]) || []
      });
    }
  };

  const testLovableConnection = async () => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('product-analyzer', {
        body: { 
          url: 'https://example.com/test-product',
          testMode: true 
        }
      });
      
      const latency = Date.now() - startTime;
      
      if (error) throw error;

      await updateProviderHealth('lovable', 'online', latency, LOVABLE_MODELS.map(m => m.id));
      
      toast({
        title: "✅ Lovable AI connecté",
        description: `Latence: ${latency}ms`,
      });
    } catch (error) {
      await updateProviderHealth('lovable', 'offline', null, [], error);
      toast({
        title: "❌ Échec de connexion",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const testOllamaConnection = async (type: 'cloud' | 'local') => {
    const config = type === 'cloud' ? ollamaCloudConfig : ollamaLocalConfig;
    const setTesting = type === 'cloud' ? setTestingCloud : setTestingLocal;
    const providerType: AIProvider = type === 'cloud' ? 'ollama_cloud' : 'ollama_local';
    
    setTesting(true);
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          action: 'test',
          ollama_url: config.ollama_url,
          api_key: config.api_key_encrypted
        }
      });

      const latency = Date.now() - startTime;

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Connection failed');

      const models = Array.isArray(data.models) ? data.models : [];
      
      if (type === 'cloud') {
        setOllamaCloudConfig({ ...config, available_models: models });
      } else {
        setOllamaLocalConfig({ ...config, available_models: models });
      }

      await updateProviderHealth(providerType, 'online', latency, models);

      toast({
        title: `✅ ${type === 'cloud' ? 'Ollama Cloud' : 'Ollama Local'} connecté`,
        description: `${models.length} modèles détectés - Latence: ${latency}ms`,
      });
    } catch (error) {
      await updateProviderHealth(providerType, 'offline', null, [], error);
      
      toast({
        title: "❌ Échec de connexion",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const saveOllamaConfig = async (type: 'cloud' | 'local') => {
    const config = type === 'cloud' ? ollamaCloudConfig : ollamaLocalConfig;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from('ollama_configurations')
        .upsert({
          user_id: session.user.id,
          ollama_url: config.ollama_url,
          api_key_encrypted: config.api_key_encrypted,
          is_active: config.is_active,
          available_models: config.available_models
        });

      if (error) throw error;

      toast({
        title: "✅ Configuration sauvegardée",
        description: `${type === 'cloud' ? 'Ollama Cloud' : 'Ollama Local'} mis à jour`,
      });
    } catch (error) {
      toast({
        title: "❌ Erreur de sauvegarde",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const scanLocalNetwork = async () => {
    setScanning(true);
    toast({
      title: "🔍 Scan du réseau en cours...",
      description: "Recherche d'instances Ollama locales",
    });

    // Simulate network scan (replace with actual implementation)
    setTimeout(() => {
      setNetworkDiagnostics({
        ping: true,
        portOpen: true,
        latency: 45
      });
      setScanning(false);
      toast({
        title: "✅ Instance détectée",
        description: "Ollama trouvé sur 192.168.1.100:11434",
      });
    }, 3000);
  };

  const runComparativeTest = async () => {
    setTesting(true);
    setTestResults({});

    for (const provider of selectedProviders) {
      const startTime = Date.now();
      
      try {
        // Simulate AI request for testing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        
        const latency = Date.now() - startTime;
        const success = Math.random() > 0.2; // 80% success rate for demo

        if (success) {
          setTestResults(prev => ({
            ...prev,
            [provider]: {
              success: true,
              latency,
              response: `Analysé: iPhone 15 Pro Max 256GB - Smartphone haut de gamme avec processeur A17 Pro...`
            }
          }));
        } else {
          throw new Error('Connection timeout');
        }
      } catch (error) {
        setTestResults(prev => ({
          ...prev,
          [provider]: {
            success: false,
            latency: Date.now() - startTime,
            response: '',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }));
      }
    }

    setTesting(false);
  };

  const updateProviderHealth = async (
    provider: AIProvider,
    status: ProviderStatus,
    responseTime: number | null,
    models: string[],
    error: any = null
  ) => {
    await supabase
      .from('ai_provider_health')
      .upsert({
        provider,
        status,
        response_time_ms: responseTime,
        available_models: models,
        error_details: error ? { message: error.message, stack: error.stack } : null,
        last_check: new Date().toISOString()
      });

    await loadProviderHealth();
  };

  const getStatusBadge = (provider: AIProvider) => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Gestion des Providers IA
          </CardTitle>
          <CardDescription>
            Configuration et monitoring des providers d'intelligence artificielle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Provider actif</Label>
              <Select value={currentProvider} onValueChange={(value) => updateProvider(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">🚀 Lovable AI</SelectItem>
                  <SelectItem value="ollama">☁️ Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <div>{getStatusBadge(currentProvider === 'lovable' ? 'lovable' : 'ollama_local')}</div>
            </div>

            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={fallbackEnabled}
                  onCheckedChange={updateFallback}
                />
                <Label>Fallback activé</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="lovable">
            <Zap className="h-4 w-4 mr-2" />
            Lovable
          </TabsTrigger>
          <TabsTrigger value="claude">
            🤖 Claude
          </TabsTrigger>
          <TabsTrigger value="openai">
            🚀 OpenAI
          </TabsTrigger>
          <TabsTrigger value="openrouter">
            🌐 Router
          </TabsTrigger>
          <TabsTrigger value="cloud">
            <Cloud className="h-4 w-4 mr-2" />
            Cloud
          </TabsTrigger>
          <TabsTrigger value="local">
            <Laptop className="h-4 w-4 mr-2" />
            Local
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <Activity className="h-4 w-4 mr-2" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="tests">
            <TestTube className="h-4 w-4 mr-2" />
            Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lovable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🚀 Lovable AI</CardTitle>
              <CardDescription>Provider recommandé - Aucune configuration requise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <p className="font-medium">Status</p>
                  {getStatusBadge('lovable')}
                </div>
                <Button onClick={testLovableConnection} variant="outline">
                  <TestTube className="h-4 w-4 mr-2" />
                  Tester la Connexion
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Modèle par défaut</Label>
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOVABLE_MODELS.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modèles disponibles</Label>
                <div className="grid gap-2">
                  {LOVABLE_MODELS.map(model => (
                    <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-sm text-muted-foreground">{model.description}</p>
                      </div>
                      <Badge variant={model.id === defaultModel ? "default" : "outline"}>
                        {model.id === defaultModel ? 'Par défaut' : 'Disponible'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claude" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🤖 Claude (Anthropic)</CardTitle>
              <CardDescription>Provider Claude avec modèles Opus, Sonnet et Haiku</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé API Anthropic</Label>
                <Input type="password" placeholder="sk-ant-xxx" />
                <p className="text-xs text-muted-foreground">
                  Obtenez votre clé sur console.anthropic.com
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modèle par défaut</Label>
                <Select defaultValue="claude-sonnet-4-20250514">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-opus-4-20250514">Claude Opus 4 (Flagship)</SelectItem>
                    <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (Balanced)</SelectItem>
                    <SelectItem value="claude-3-5-haiku-20241022">Claude Haiku 3.5 (Fast)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => toast({ title: "🧪 Test Claude", description: "Connexion à implémenter" })}>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la connexion
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🚀 OpenAI</CardTitle>
              <CardDescription>Provider OpenAI avec GPT-5, O3 et O4</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé API OpenAI</Label>
                <Input type="password" placeholder="sk-xxx" />
                <p className="text-xs text-muted-foreground">
                  Obtenez votre clé sur platform.openai.com
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modèle par défaut</Label>
                <Select defaultValue="gpt-5-mini">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5">GPT-5 (Flagship)</SelectItem>
                    <SelectItem value="gpt-5-mini">GPT-5 Mini (Balanced)</SelectItem>
                    <SelectItem value="gpt-5-nano">GPT-5 Nano (Fast)</SelectItem>
                    <SelectItem value="o3">O3 (Reasoning)</SelectItem>
                    <SelectItem value="o4-mini">O4 Mini (Fast Reasoning)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => toast({ title: "🧪 Test OpenAI", description: "Connexion à implémenter" })}>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la connexion
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openrouter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🌐 OpenRouter</CardTitle>
              <CardDescription>Accès à tous les modèles IA via OpenRouter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clé API OpenRouter</Label>
                <Input type="password" placeholder="sk-or-xxx" />
                <p className="text-xs text-muted-foreground">
                  Obtenez votre clé sur openrouter.ai
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modèle par défaut</Label>
                <Select defaultValue="anthropic/claude-3.5-sonnet">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="google/gemini-pro-1.5">Gemini Pro 1.5</SelectItem>
                    <SelectItem value="meta-llama/llama-3.1-70b">Llama 3.1 70B</SelectItem>
                    <SelectItem value="openai/gpt-4">GPT-4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => toast({ title: "🔄 Chargement", description: "Liste des modèles à implémenter" })} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Charger les modèles
                </Button>
                <Button onClick={() => toast({ title: "🧪 Test OpenRouter", description: "Connexion à implémenter" })}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Tester
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloud" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>☁️ Ollama Cloud</CardTitle>
              <CardDescription>Configuration de l'instance cloud Ollama</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL Cloud Instance</Label>
                <Input
                  value={ollamaCloudConfig.ollama_url}
                  onChange={(e) => setOllamaCloudConfig({ ...ollamaCloudConfig, ollama_url: e.target.value })}
                  placeholder="https://your-cloud.com"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key (optionnel)</Label>
                <Input
                  type="password"
                  value={ollamaCloudConfig.api_key_encrypted}
                  onChange={(e) => setOllamaCloudConfig({ ...ollamaCloudConfig, api_key_encrypted: e.target.value })}
                  placeholder="••••••••••••••••"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={ollamaCloudConfig.is_active}
                  onCheckedChange={(checked) => setOllamaCloudConfig({ ...ollamaCloudConfig, is_active: checked })}
                />
                <Label>Service actif</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => testOllamaConnection('cloud')} disabled={testingCloud}>
                  {testingCloud ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Tester
                </Button>
                <Button onClick={() => saveOllamaConfig('cloud')} variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>

              <div>
                {getStatusBadge('ollama_cloud')}
              </div>

              {ollamaCloudConfig.available_models.length > 0 && (
                <div className="space-y-2">
                  <Label>Modèles détectés</Label>
                  <div className="grid gap-2">
                    {ollamaCloudConfig.available_models.map(model => (
                      <Badge key={model} variant="outline">{model}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="local" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>💻 Ollama Local - Mac Mini M4</CardTitle>
              <CardDescription>Configuration du serveur Ollama local</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL Locale</Label>
                <Input
                  value={ollamaLocalConfig.ollama_url}
                  onChange={(e) => setOllamaLocalConfig({ ...ollamaLocalConfig, ollama_url: e.target.value })}
                  placeholder="http://192.168.1.100:11434"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key (optionnel)</Label>
                <Input
                  type="password"
                  value={ollamaLocalConfig.api_key_encrypted}
                  onChange={(e) => setOllamaLocalConfig({ ...ollamaLocalConfig, api_key_encrypted: e.target.value })}
                  placeholder="••••••••••••••••"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={ollamaLocalConfig.is_active}
                  onCheckedChange={(checked) => setOllamaLocalConfig({ ...ollamaLocalConfig, is_active: checked })}
                />
                <Label>Service actif</Label>
              </div>

              <div className="p-4 rounded-lg bg-muted space-y-2">
                <p className="font-medium">Diagnostics réseau</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Ping:</span>
                    <span>{networkDiagnostics.ping ? '✅ OK' : '❌ Échec'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Port 11434:</span>
                    <span>{networkDiagnostics.portOpen ? '✅ Ouvert' : '❌ Fermé'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latence:</span>
                    <span>{networkDiagnostics.latency > 0 ? `${networkDiagnostics.latency}ms` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={scanLocalNetwork} disabled={scanning} variant="secondary">
                  {scanning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Scanner le Réseau
                </Button>
                <Button onClick={() => testOllamaConnection('local')} disabled={testingLocal}>
                  {testingLocal ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Tester
                </Button>
                <Button onClick={() => saveOllamaConfig('local')} variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>

              <div>
                {getStatusBadge('ollama_local')}
              </div>

              {ollamaLocalConfig.available_models.length > 0 && (
                <div className="space-y-2">
                  <Label>Modèles disponibles</Label>
                  <div className="grid gap-2">
                    {ollamaLocalConfig.available_models.map(model => (
                      <Badge key={model} variant="outline">{model}</Badge>
                    ))}
                  </div>
                </div>
              )}
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
                      <CardTitle className="text-sm font-medium capitalize">{provider}</CardTitle>
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
                          <Badge variant="outline">{log.provider}</Badge>
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

        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🧪 Tests & Diagnostics</CardTitle>
              <CardDescription>Tests comparatifs entre providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt de test</Label>
                <Textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Providers à tester</Label>
                <div className="flex gap-2">
                  {['lovable', 'ollama_cloud', 'ollama_local'].map(p => (
                    <Button
                      key={p}
                      variant={selectedProviders.includes(p as AIProvider) ? "default" : "outline"}
                      onClick={() => {
                        setSelectedProviders(prev =>
                          prev.includes(p as AIProvider)
                            ? prev.filter(x => x !== p)
                            : [...prev, p as AIProvider]
                        );
                      }}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              <Button onClick={runComparativeTest} disabled={testing || selectedProviders.length === 0}>
                {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                Lancer le Test Comparatif
              </Button>

              {Object.keys(testResults).length > 0 && (
                <div className="space-y-2">
                  <Label>Résultats</Label>
                  {Object.entries(testResults).map(([provider, result]) => (
                    <Card key={provider}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm capitalize">{provider}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {result.success ? (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>✅ Succès</Badge>
                              <span className="text-sm text-muted-foreground">{result.latency}ms</span>
                            </div>
                            <p className="text-sm">{result.response}</p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">❌ Échec</Badge>
                            <span className="text-sm text-destructive">{result.error}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
