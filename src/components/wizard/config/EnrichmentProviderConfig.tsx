import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Brain, Sparkles, Zap, Info } from 'lucide-react';

export const EnrichmentProviderConfig = () => {
  const { updateConfiguration, state, updateAdvancedOptions } = useWizard();
  const [provider, setProvider] = useState(state.advancedOptions.aiProvider || 'lovable-ai');
  const [apiKey, setApiKey] = useState(state.configuration.aiApiKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(state.configuration.ollamaUrl || 'http://localhost:11434');
  const [temperature, setTemperature] = useState(state.configuration.temperature || 0.7);
  const [model, setModel] = useState(state.configuration.aiModel || '');

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

  const handleTemperatureChange = (value: number[]) => {
    setTemperature(value[0]);
    updateConfiguration({ temperature: value[0] });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    updateConfiguration({ aiModel: value });
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
                    OpenAI
                  </div>
                </SelectItem>
                <SelectItem value="ollama">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Ollama (Local)
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
                <Label htmlFor="openai-model">Modèle</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger id="openai-model">
                    <SelectValue placeholder="gpt-4o" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
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
                <Label htmlFor="ollama-model">Modèle</Label>
                <Input
                  id="ollama-model"
                  placeholder="llama3.2, mistral, etc."
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
    </div>
  );
};
