import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Brain, Cloud, Server, Wifi } from "lucide-react";

export type AIProvider = 'lovable' | 'claude' | 'openai' | 'openrouter' | 'ollama_cloud' | 'ollama_local';

interface EnrichmentProviderSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (provider: AIProvider) => void;
}

interface ProviderConfig {
  id: AIProvider;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: 'online' | 'offline' | 'unconfigured';
  configured: boolean;
  isUserConfig?: boolean;
}

export function EnrichmentProviderSelector({ open, onOpenChange, onSelect }: EnrichmentProviderSelectorProps) {
  const [selected, setSelected] = useState<AIProvider>('lovable');
  const [providers, setProviders] = useState<ProviderConfig[]>([
    {
      id: 'lovable',
      name: 'Lovable AI',
      icon: <Sparkles className="h-5 w-5" />,
      description: 'Recommandé - Gratuit et rapide',
      status: 'online',
      configured: true,
      isUserConfig: false
    },
    {
      id: 'claude',
      name: 'Claude',
      icon: <Brain className="h-5 w-5" />,
      description: 'Anthropic (Opus, Sonnet, Haiku)',
      status: 'unconfigured',
      configured: false
    },
    {
      id: 'openai',
      name: 'OpenAI',
      icon: <Sparkles className="h-5 w-5" />,
      description: 'GPT-5, O3, O4',
      status: 'unconfigured',
      configured: false
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      icon: <Wifi className="h-5 w-5" />,
      description: 'Accès multi-modèles',
      status: 'unconfigured',
      configured: false
    },
    {
      id: 'ollama_cloud',
      name: 'Ollama Cloud',
      icon: <Cloud className="h-5 w-5" />,
      description: 'Instance cloud',
      status: 'unconfigured',
      configured: false
    },
    {
      id: 'ollama_local',
      name: 'Ollama Local',
      icon: <Server className="h-5 w-5" />,
      description: 'Serveur local',
      status: 'unconfigured',
      configured: false
    }
  ]);

  useEffect(() => {
    if (open) {
      loadProviderStatuses();
    }
  }, [open]);

  const loadProviderStatuses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Charger les statuts de santé
    const { data: healthData } = await supabase
      .from('ai_provider_health')
      .select('*');

    // Charger les configs utilisateur
    const { data: configData } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .eq('user_id', user.id);

    // Mettre à jour les providers
    setProviders(prev => prev.map(provider => {
      const health = healthData?.find(h => h.provider === provider.id);
      const config = configData?.find(c => c.provider === provider.id);
      const status = health?.status || 'unconfigured';
      
      return {
        ...provider,
        status: status as 'online' | 'offline' | 'unconfigured',
        configured: config?.is_active || false,
        isUserConfig: !!config
      };
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🎯 Sélectionnez votre Provider IA pour l'Enrichissement</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {providers.map((provider) => (
            <Card
              key={provider.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selected === provider.id ? 'ring-2 ring-primary' : ''
              } ${!provider.configured ? 'opacity-60' : ''}`}
              onClick={() => provider.configured && setSelected(provider.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{provider.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      {provider.name}
                      {provider.isUserConfig && (
                        <Badge variant="outline" className="text-xs">
                          🔐 Perso
                        </Badge>
                      )}
                      {!provider.isUserConfig && provider.configured && (
                        <Badge variant="outline" className="text-xs">
                          🔓 Global
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {provider.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(provider.status)}`} />
                  <span className="text-xs text-muted-foreground">
                    {provider.status === 'online' ? 'Online' : 
                     provider.status === 'offline' ? 'Offline' : 'Non configuré'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={() => {
              onSelect(selected);
              onOpenChange(false);
            }}
            disabled={!providers.find(p => p.id === selected)?.configured}
          >
            Re-enrichir avec {providers.find(p => p.id === selected)?.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
