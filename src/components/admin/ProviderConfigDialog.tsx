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

      if (error) throw error;

      setTestResult({
        success: data.testResult.success,
        latency: data.testResult.latency,
        models: data.testResult.models,
        error: data.testResult.error
      });

      if (data.testResult.success) {
        toast.success(`✅ Connexion réussie (${data.testResult.latency}ms)`);
      } else {
        toast.error(`❌ Test échoué: ${data.testResult.error}`);
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
                    <p className="text-sm text-green-700">
                      Modèles disponibles : {testResult.models.slice(0, 3).join(', ')}
                      {testResult.models.length > 3 && ` (+${testResult.models.length - 3} autres)`}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="text-sm text-red-700">{testResult.error}</p>
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