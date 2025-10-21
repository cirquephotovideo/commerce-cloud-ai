import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Brain, Sparkles, Zap, Info, Globe, Cloud } from 'lucide-react';

export const EnrichmentProviderConfig = () => {
  const { updateConfiguration, state, updateAdvancedOptions } = useWizard();
  const [provider, setProvider] = useState(state.advancedOptions.aiProvider || 'lovable-ai');
  const [apiKey, setApiKey] = useState(state.configuration.aiApiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(state.configuration.ollamaUrl || 'http://localhost:11434');
  const [ollamaCloudKey, setOllamaCloudKey] = useState(state.configuration.ollamaCloudKey || '');
  const [anthropicKey, setAnthropicKey] = useState(state.configuration.anthropicKey || '');
  const [temperature, setTemperature] = useState(state.configuration.temperature || 0.7);
  const [model, setModel] = useState(state.configuration.aiModel || '');
  const [webSearchEnabled, setWebSearchEnabled] = useState(state.configuration.webSearchEnabled || false);

  const handleProviderChange = (value: string) => {
    setProvider(value as any);
    updateAdvancedOptions({ aiProvider: value as any });
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    updateConfiguration({ aiApiKey: value });
  };

  const handleOllamaUrlChange = (value: string) => {
    setOllamaUrl(value);
    updateConfiguration({ ollamaUrl: value });
  };

  const handleOllamaCloudKeyChange = (value: string) => {
    setOllamaCloudKey(value);
    updateConfiguration({ ollamaCloudKey: value });
  };

  const handleAnthropicKeyChange = (value: string) => {
    setAnthropicKey(value);
    updateConfiguration({ anthropicKey: value });
  };

  const handleTemperatureChange = (value: number[]) => {
    setTemperature(value[0]);
    updateConfiguration({ temperature: value[0] });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    updateConfiguration({ aiModel: value });
  };

  const handleWebSearchToggle = (checked: boolean) => {
    setWebSearchEnabled(checked);
    updateConfiguration({ webSearchEnabled: checked });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configuration de l'enrichissement IA</h3>
        <p className="text-sm text-muted-foreground">
          Choisissez votre fournisseur IA et configurez les paramètres
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Fournisseur IA
          </CardTitle>
          <CardDescription>Sélectionnez le provider pour l'enrichissement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="provider">Provider *</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable-ai">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Lovable AI (Recommandé - Pas de clé requise)
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    OpenAI (GPT-5, GPT-4)
                  </div>
                </SelectItem>
                <SelectItem value="anthropic">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Anthropic (Claude)
                  </div>
                </SelectItem>
                <SelectItem value="ollama">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Ollama (Local)
                  </div>
                </SelectItem>
                <SelectItem value="ollama_cloud">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Ollama Cloud
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === 'lovable-ai' && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                Lovable AI est intégré et ne nécessite aucune configuration supplémentaire. 
                Modèles disponibles : Gemini 2.5 Pro, GPT-5, GPT-5 Mini
              </AlertDescription>
            </Alert>
          )}

          {provider === 'lovable-ai' && (
            <div>
              <Label htmlFor="lovable-model">Modèle *</Label>
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger id="lovable-model">
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (Multimodal)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Rapide)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Économique)</SelectItem>
                  <SelectItem value="openai/gpt-5">GPT-5 (Précis)</SelectItem>
                  <SelectItem value="openai/gpt-5-mini">GPT-5 Mini (Équilibré)</SelectItem>
                  <SelectItem value="openai/gpt-5-nano">GPT-5 Nano (Rapide)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {provider === 'openai' && (
            <>
              <div>
                <Label htmlFor="openai-key">Clé API OpenAI *</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Obtenez votre clé sur platform.openai.com
                </p>
              </div>
              <div>
                <Label htmlFor="openai-model">Modèle *</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger id="openai-model">
                    <SelectValue placeholder="Sélectionner un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5">GPT-5 (Flagship)</SelectItem>
                    <SelectItem value="gpt-5-mini">GPT-5 Mini (Rapide)</SelectItem>
                    <SelectItem value="gpt-5-nano">GPT-5 Nano (Économique)</SelectItem>
                    <SelectItem value="gpt-4.1">GPT-4.1 (Fiable)</SelectItem>
                    <SelectItem value="o3">O3 (Raisonnement avancé)</SelectItem>
                    <SelectItem value="o4-mini">O4 Mini (Raisonnement rapide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {provider === 'anthropic' && (
            <>
              <div>
                <Label htmlFor="anthropic-key">Clé API Anthropic *</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => handleAnthropicKeyChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Obtenez votre clé sur console.anthropic.com
                </p>
              </div>
              <div>
                <Label htmlFor="anthropic-model">Modèle *</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger id="anthropic-model">
                    <SelectValue placeholder="Sélectionner un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-5">Claude Sonnet 4.5 (Recommandé)</SelectItem>
                    <SelectItem value="claude-opus-4-1">Claude Opus 4.1 (Puissant)</SelectItem>
                    <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-3-7-sonnet">Claude 3.7 Sonnet</SelectItem>
                    <SelectItem value="claude-3-5-haiku">Claude 3.5 Haiku (Rapide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {provider === 'ollama' && (
            <>
              <div>
                <Label htmlFor="ollama-url">URL Ollama *</Label>
                <Input
                  id="ollama-url"
                  placeholder="http://localhost:11434"
                  value={ollamaUrl}
                  onChange={(e) => handleOllamaUrlChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL de votre instance Ollama locale
                </p>
              </div>
              <div>
                <Label htmlFor="ollama-model">Modèle *</Label>
                <Input
                  id="ollama-model"
                  placeholder="llama3.2, mistral, qwen2.5, etc."
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                />
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Assurez-vous qu'Ollama est installé et en cours d'exécution localement
                </AlertDescription>
              </Alert>
            </>
          )}

          {provider === 'ollama_cloud' && (
            <>
              <div>
                <Label htmlFor="ollama-cloud-key">Clé API Ollama Cloud *</Label>
                <Input
                  id="ollama-cloud-key"
                  type="password"
                  placeholder="Votre clé API Ollama Cloud"
                  value={ollamaCloudKey}
                  onChange={(e) => handleOllamaCloudKeyChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Obtenez votre clé sur ollama.com/cloud
                </p>
              </div>
              <div>
                <Label htmlFor="ollama-cloud-model">Modèle *</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger id="ollama-cloud-model">
                    <SelectValue placeholder="Sélectionner un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llama3.2">Llama 3.2</SelectItem>
                    <SelectItem value="llama3.1">Llama 3.1</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="qwen2.5">Qwen 2.5</SelectItem>
                    <SelectItem value="gemma2">Gemma 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Alert>
                <Cloud className="h-4 w-4" />
                <AlertDescription>
                  Ollama Cloud permet d'accéder aux modèles open-source via une API hébergée
                </AlertDescription>
              </Alert>
            </>
          )}

          <div>
            <Label htmlFor="temperature">
              Température : {temperature.toFixed(1)}
            </Label>
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.1}
              value={[temperature]}
              onValueChange={handleTemperatureChange}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Plus bas = plus cohérent, plus haut = plus créatif
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Recherche Web
          </CardTitle>
          <CardDescription>Activer la recherche web en temps réel pour des données à jour</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="web-search">Activer la recherche web</Label>
              <p className="text-xs text-muted-foreground">
                L'IA pourra effectuer des recherches sur Internet pour enrichir les données produits
              </p>
            </div>
            <Switch
              id="web-search"
              checked={webSearchEnabled}
              onCheckedChange={handleWebSearchToggle}
            />
          </div>

          {webSearchEnabled && (
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                La recherche web sera utilisée pour obtenir des informations à jour : prix du marché, 
                avis clients, spécifications techniques récentes, etc.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
