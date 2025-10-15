import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type AIProviderConfigurable = 'claude' | 'openai' | 'openrouter' | 'heygen';

interface ProviderConfigDialogProps {
  provider: AIProviderConfigurable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface TestResult {
  success: boolean;
  latency?: number;
  models?: string[];
  error?: string;
}

export const ProviderConfigDialog = ({ provider, open, onOpenChange, onSuccess }: ProviderConfigDialogProps) => {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const providerNames: Record<AIProviderConfigurable, string> = {
    claude: "Claude (Anthropic)",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    heygen: "HeyGen"
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('save-provider-config', {
        body: {
          provider,
          api_key: apiKey,
          test_only: true
        }
      });

      // Network error (no data at all)
      if (error && !data) {
        setTestResult({
          success: false,
          error: error.message || 'Erreur réseau'
        });
        toast.error(`❌ ${error.message || 'Erreur réseau'}`);
        return;
      }

      // Edge function always returns 200 in test_only mode with success/error/models in body
      setTestResult({
        success: !!data?.success,
        latency: data?.latency,
        models: data?.models,
        error: data?.error
      });

      if (data?.success) {
        toast.success(`✅ Connexion réussie (${data.latency}ms)`);
      } else {
        toast.error(`❌ ${data?.error || 'Test échoué'}`);
      }
    } catch (err) {
      console.error('[ProviderConfigDialog] Test error:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue'
      });
      toast.error("Erreur lors du test de connexion");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }

    if (!testResult?.success) {
      toast.error("Veuillez d'abord tester la connexion");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.functions.invoke('save-provider-config', {
        body: {
          provider,
          api_key: apiKey,
          test_only: false
        }
      });

      if (error) throw error;

      toast.success("✅ Configuration sauvegardée");
      setApiKey("");
      setTestResult(null);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('[ProviderConfigDialog] Save error:', err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setApiKey("");
    setTestResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurer {providerNames[provider]}</DialogTitle>
          <DialogDescription>
            Entrez votre clé API pour activer ce fournisseur d'IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Clé API</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={testing || saving}
            />
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${
              testResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p className={`font-medium ${
                    testResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {testResult.success ? 'Connexion réussie' : 'Échec de connexion'}
                  </p>
                  {testResult.success && testResult.latency && (
                    <p className="text-sm text-green-700">
                      Latence : {testResult.latency}ms
                    </p>
                  )}
                  {testResult.success && testResult.models && testResult.models.length > 0 && (
                    <div className="text-sm text-green-700 space-y-2">
                      <p className="font-medium">Modèles disponibles :</p>
                      <p className="text-xs">{testResult.models.join(', ')}</p>
                      {provider === 'claude' && (
                        <div className="mt-2 p-2 bg-green-100 rounded border border-green-200">
                          <p className="font-medium text-xs mb-1">Coûts indicatifs :</p>
                          <ul className="text-xs space-y-0.5">
                            <li>• <strong>Haiku</strong> : économique, rapide</li>
                            <li>• <strong>Sonnet</strong> : équilibré qualité/prix</li>
                            <li>• <strong>Opus</strong> : premium, coût élevé</li>
                          </ul>
                          <a 
                            href="https://docs.anthropic.com/en/docs/about-claude/models" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800 underline block mt-1.5 text-xs"
                          >
                            Voir les tarifs détaillés →
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {testResult.error && (
                    <p className="text-sm text-red-700 break-words">{testResult.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={testing || saving}>
            Annuler
          </Button>
          <Button onClick={handleTest} disabled={testing || saving || !apiKey.trim()}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              'Tester la connexion'
            )}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !testResult?.success}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              'Sauvegarder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};