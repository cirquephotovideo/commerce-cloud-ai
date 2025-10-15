import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, TestTube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

interface APIKeyStatus {
  service: string;
  isValid: boolean | null;
  error?: string;
  statusCode?: number;
  rawMessage?: string;
  hints?: string[];
  tested?: Array<{ source: string; valid: boolean; statusCode?: number; error?: string }>;
  lastChecked?: Date;
}

export const GlobalAPIKeysManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  
  const [googleSearchKey, setGoogleSearchKey] = useState("");
  const [googleSearchCx, setGoogleSearchCx] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [serperKey, setSerperKey] = useState("");
  const [useSerperSaved, setUseSerperSaved] = useState(false);
  
  const [keyStatuses, setKeyStatuses] = useState<Record<string, APIKeyStatus>>({});

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      
      // Fetch API keys statuses from verify-api-keys function
      const { data, error } = await supabase.functions.invoke('verify-api-keys');
      
      if (error) throw error;
      
      if (data?.keys) {
        const statusMap: Record<string, APIKeyStatus> = {};
        data.keys.forEach((key: any) => {
          statusMap[key.name] = {
            service: key.name,
            isValid: key.status === 'configured',
            lastChecked: new Date()
          };
        });
        setKeyStatuses(statusMap);
      }
    } catch (error: any) {
      console.error('Error fetching API keys:', error);
      toast({
        title: "Erreur",
        description: "Impossible de récupérer le statut des clés API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testAPIKey = async (service: string, key?: string, cx?: string, url?: string, useSaved?: boolean) => {
    try {
      setTesting(service);
      
      // Trim values before testing
      const trimmedKey = key?.trim();
      const trimmedCx = cx?.trim();
      const trimmedUrl = url?.trim();
      
      // Client-side validation for Serper
      if (service === 'Serper' && trimmedKey) {
        const serperKeyPattern = /^[A-Fa-f0-9]{64}$/;
        if (!serperKeyPattern.test(trimmedKey)) {
          toast({
            title: "❌ Format invalide",
            description: "La clé Serper doit contenir 64 caractères hexadécimaux.",
            variant: "destructive",
          });
          setTesting(null);
          return;
        }
      }
      
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'test',
          service,
          key: trimmedKey,
          cx: trimmedCx,
          url: trimmedUrl,
          useSaved
        }
      });

      if (error) throw error;

      setKeyStatuses(prev => ({
        ...prev,
        [service]: {
          service,
          isValid: data.valid,
          error: data.error,
          statusCode: data.statusCode,
          rawMessage: data.rawMessage,
          hints: data.hints,
          tested: data.tested,
          lastChecked: new Date()
        }
      }));

      toast({
        title: data.valid ? "✅ Clé valide" : "❌ Clé invalide",
        description: data.error || `La clé ${service} fonctionne correctement`,
        variant: data.valid ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error(`Error testing ${service}:`, error);
      toast({
        title: "Erreur de test",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const renderKeyStatus = (service: string) => {
    const status = keyStatuses[service];
    if (!status) return null;

    return (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-2">
          {status.isValid === true && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Configurée et valide</span>
            </>
          )}
          {status.isValid === false && (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {status.error || "Clé invalide"}
              </span>
            </>
          )}
          {status.lastChecked && (
            <span className="text-xs text-muted-foreground ml-auto">
              Testé: {status.lastChecked.toLocaleTimeString('fr-FR')}
            </span>
          )}
        </div>
        
        {/* Detailed diagnostics */}
        {status.isValid === false && (status.statusCode || status.rawMessage) && (
          <div className="text-xs text-muted-foreground pl-6">
            Détails: HTTP {status.statusCode} — {status.rawMessage}
          </div>
        )}
        
        {/* Hints */}
        {status.hints && status.hints.length > 0 && (
          <ul className="text-xs text-muted-foreground pl-6 list-disc list-inside">
            {status.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        )}
        
        {/* Comparative results */}
        {status.tested && status.tested.length > 1 && (
          <div className="pl-6 space-y-1 text-xs">
            {status.tested.map((test, i) => (
              <div key={i} className="flex items-center gap-2">
                {test.valid ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span className={test.valid ? "text-green-600" : "text-destructive"}>
                  {test.source === 'typed' ? 'Clé saisie' : 'Clé sauvegardée'}: 
                  {test.valid ? ' valide' : ` invalide (${test.error || `HTTP ${test.statusCode}`})`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Ces clés API sont stockées comme secrets Supabase. Vous pouvez tester leur validité sans les modifier.
          Pour mettre à jour une clé, utilisez la CLI Supabase ou le dashboard.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSecrets(!showSecrets)}
        >
          {showSecrets ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Masquer les clés
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Afficher les clés
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchAPIKeys}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Rafraîchir le statut"
          )}
        </Button>
      </div>

      {/* Google Search API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google Search API
            {keyStatuses['Google Search']?.isValid === true && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </CardTitle>
          <CardDescription>
            API pour les recherches Google personnalisées (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="google-key">API Key</Label>
            <Input
              id="google-key"
              type={showSecrets ? "text" : "password"}
              value={googleSearchKey}
              onChange={(e) => setGoogleSearchKey(e.target.value)}
              placeholder="AIza..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-cx">Custom Search Engine ID (CX)</Label>
            <Input
              id="google-cx"
              type={showSecrets ? "text" : "password"}
              value={googleSearchCx}
              onChange={(e) => setGoogleSearchCx(e.target.value)}
              placeholder="cx:..."
            />
          </div>
          <Button
            onClick={() => testAPIKey('Google Search', googleSearchKey, googleSearchCx)}
            disabled={!googleSearchKey || !googleSearchCx || testing === 'Google Search'}
            className="w-full"
          >
            {testing === 'Google Search' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la clé
              </>
            )}
          </Button>
          {renderKeyStatus('Google Search')}
        </CardContent>
      </Card>

      {/* Serper API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Serper API
            {keyStatuses['Serper']?.isValid === true && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </CardTitle>
          <CardDescription>
            API alternative pour les recherches Google (SERPER_API_KEY)
            <br />Format: 64 caractères hexadécimaux
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serper-key">API Key</Label>
            <Input
              id="serper-key"
              type={showSecrets ? "text" : "password"}
              value={serperKey}
              onChange={(e) => setSerperKey(e.target.value)}
              placeholder="Votre clé Serper (64 caractères hex)"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="use-serper-saved"
              checked={useSerperSaved}
              onCheckedChange={setUseSerperSaved}
            />
            <Label htmlFor="use-serper-saved" className="text-sm cursor-pointer">
              Tester aussi la clé sauvegardée (secret backend)
            </Label>
          </div>
          
          <Button
            onClick={() => testAPIKey('Serper', serperKey, undefined, undefined, useSerperSaved)}
            disabled={(!serperKey && !useSerperSaved) || testing === 'Serper'}
            className="w-full"
          >
            {testing === 'Serper' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la clé
              </>
            )}
          </Button>
          {renderKeyStatus('Serper')}
        </CardContent>
      </Card>

      {/* Stripe API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Stripe API
            {keyStatuses['Stripe']?.isValid === true && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </CardTitle>
          <CardDescription>
            API pour les paiements et abonnements. Deux clés sont nécessaires :
            <br />• <strong>STRIPE_SECRET_KEY</strong> (côté serveur, à tester ci-dessous)
            <br />• <strong>STRIPE_PUBLISHABLE_KEY</strong> (côté client, publique, pas besoin de test)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stripe-key">Secret Key</Label>
            <Input
              id="stripe-key"
              type={showSecrets ? "text" : "password"}
              value={stripeKey}
              onChange={(e) => setStripeKey(e.target.value)}
              placeholder="sk_..."
            />
          </div>
          <Button
            onClick={() => testAPIKey('Stripe', stripeKey)}
            disabled={!stripeKey || testing === 'Stripe'}
            className="w-full"
          >
            {testing === 'Stripe' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la clé
              </>
            )}
          </Button>
          {renderKeyStatus('Stripe')}
        </CardContent>
      </Card>

      {/* Resend API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Resend API
            {keyStatuses['Resend']?.isValid === true && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </CardTitle>
          <CardDescription>
            API pour l'envoi d'emails (RESEND_API_KEY)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resend-key">API Key</Label>
            <Input
              id="resend-key"
              type={showSecrets ? "text" : "password"}
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              placeholder="re_..."
            />
          </div>
          <Button
            onClick={() => testAPIKey('Resend', resendKey)}
            disabled={!resendKey || testing === 'Resend'}
            className="w-full"
          >
            {testing === 'Resend' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Tester la clé
              </>
            )}
          </Button>
          {renderKeyStatus('Resend')}
        </CardContent>
      </Card>
    </div>
  );
};