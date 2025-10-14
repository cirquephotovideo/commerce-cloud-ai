import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Settings, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AIProvider = 'lovable' | 'claude' | 'openai' | 'openrouter' | 'ollama_cloud' | 'ollama_local';

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  icon: string;
  description: string;
  status: 'online' | 'offline' | 'not_configured';
  configured: boolean;
  requiresApiKey: boolean;
}

interface ProviderSelectorProps {
  selected: AIProvider;
  onSelect: (provider: AIProvider) => void;
  onConfigure: (provider: AIProvider) => void;
}

const AVAILABLE_PROVIDERS: ProviderConfig[] = [
  {
    id: 'lovable',
    name: 'Lovable AI',
    icon: '🚀',
    description: 'Recommandé - Gratuit',
    status: 'online',
    configured: true,
    requiresApiKey: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '🤖',
    description: 'Anthropic (Opus, Sonnet, Haiku)',
    status: 'not_configured',
    configured: false,
    requiresApiKey: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🔥',
    description: 'GPT-5, O3, O4',
    status: 'not_configured',
    configured: false,
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    description: 'Accès multi-modèles',
    status: 'not_configured',
    configured: false,
    requiresApiKey: true,
  },
  {
    id: 'ollama_cloud',
    name: 'Ollama Cloud',
    icon: '☁️',
    description: 'Instance cloud',
    status: 'not_configured',
    configured: false,
    requiresApiKey: false,
  },
  {
    id: 'ollama_local',
    name: 'Ollama Local',
    icon: '💻',
    description: 'Serveur local',
    status: 'not_configured',
    configured: false,
    requiresApiKey: false,
  },
];

export function ProviderSelector({ selected, onSelect, onConfigure }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>(AVAILABLE_PROVIDERS);

  useEffect(() => {
    loadProviderStatuses();
    // Forcer la synchro Ollama si configuré
    syncOllamaIfConfigured();
  }, []);

  const syncOllamaIfConfigured = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Vérifier si Ollama est configuré
    const { data: ollamaConfig } = await supabase
      .from('ollama_configurations')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ollamaConfig) {
      console.log('[ProviderSelector] Forcing Ollama sync...');
      await supabase.functions.invoke('sync-ollama-to-providers');
      // Recharger les statuts après la synchro
      setTimeout(() => loadProviderStatuses(), 1000);
    }
  };

  const loadProviderStatuses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load provider health statuses
    const { data: healthData } = await supabase
      .from('ai_provider_health')
      .select('*');

    // Load provider configs (user + global)
    const { data: configData } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`);

    const updatedProviders = AVAILABLE_PROVIDERS.map(provider => {
      const health = healthData?.find(h => h.provider === provider.id);
      const userConfig = configData?.find(c => c.provider === provider.id && c.user_id === user.id);
      const globalConfig = configData?.find(c => c.provider === provider.id && c.user_id === null);
      const config = userConfig || globalConfig;

      let status: 'online' | 'offline' | 'not_configured' = 'not_configured';
      let configured = provider.id === 'lovable'; // Lovable is always configured

      if (provider.id === 'lovable') {
        status = 'online';
      } else if (health) {
        status = health.status as 'online' | 'offline';
        configured = config?.is_active || false;
      }

      return {
        ...provider,
        status,
        configured,
        isUserConfig: !!userConfig,
      };
    });

    setProviders(updatedProviders);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'online':
        return 'default';
      case 'offline':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢 Online';
      case 'offline':
        return '🔴 Offline';
      default:
        return '⚪ À configurer';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
              selected === provider.id && "ring-2 ring-primary shadow-lg"
            )}
            onClick={() => provider.configured && onSelect(provider.id)}
          >
            <CardContent className="p-4 text-center space-y-2">
              <div className="text-3xl">{provider.icon}</div>
              <h3 className="font-bold text-sm">{provider.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {provider.description}
              </p>
              <Badge variant={getStatusVariant(provider.status)} className="text-xs">
                {getStatusLabel(provider.status)}
              </Badge>
              {provider.configured && (provider as any).isUserConfig !== undefined && (
                <Badge variant={(provider as any).isUserConfig ? "default" : "outline"} className="text-xs">
                  {(provider as any).isUserConfig ? "🔐 Perso" : "🔓 Global"}
                </Badge>
              )}
              {selected === provider.id && provider.configured && (
                <CheckCircle className="h-4 w-4 mx-auto text-primary" />
              )}
              {!provider.configured && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigure(provider.id);
                  }}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configurer
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
