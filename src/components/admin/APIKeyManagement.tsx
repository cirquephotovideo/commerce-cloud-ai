import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, RefreshCw, AlertCircle, Eye, EyeOff, Save, ExternalLink, Copy, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AmazonHealthStatus } from "./AmazonHealthStatus";
import { AmazonSetupGuide } from "./AmazonSetupGuide";
import { AmazonErrorTester } from "./AmazonErrorTester";

export const APIKeyManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Amazon state
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [amazonTesting, setAmazonTesting] = useState(false);
  const [amazonRotating, setAmazonRotating] = useState(false);
  const [amazonAuthorizing, setAmazonAuthorizing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('A13V1IB3VIYZZH');
  const [showAmazonSecrets, setShowAmazonSecrets] = useState(false);
  const [secretExpiresAt, setSecretExpiresAt] = useState<string | null>(null);
  const [lastRotationAt, setLastRotationAt] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  
  // OAuth state
  const [appId, setAppId] = useState('');
  const [region, setRegion] = useState<'EU' | 'NA' | 'FE'>('EU');
  const [rdtDelegation, setRdtDelegation] = useState(false);

  const fetchAmazonData = async () => {
    try {
      const { data: credData } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (credData) {
        setClientId(credData.client_id || '');
        setMarketplaceId(credData.marketplace_id || '');
        setSecretExpiresAt(credData.secret_expires_at || null);
        setLastRotationAt(credData.last_rotation_at || null);
        setRdtDelegation(credData.rdt_delegation || false);
      }
    } catch (error) {
      console.error('Error fetching Amazon data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmazonData();
    
    // Vérifier les paramètres URL pour succès/erreur OAuth
    const params = new URLSearchParams(window.location.search);
    const success = params.get('amazon_success');
    const error = params.get('amazon_error');
    
    if (success) {
      toast({
        title: "✅ Autorisation réussie",
        description: success,
      });
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/admin');
      fetchAmazonData();
    }
    
    if (error) {
      toast({
        title: "❌ Erreur d'autorisation",
        description: error,
        variant: "destructive",
      });
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  const handleSaveAmazon = async () => {
    setAmazonLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('amazon_credentials')
        .upsert({
          client_id: clientId,
          client_secret_encrypted: clientSecret,
          refresh_token_encrypted: refreshToken,
          marketplace_id: marketplaceId,
          rdt_delegation: rdtDelegation,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "✅ Credentials sauvegardées",
        description: "Les clés Amazon ont été enregistrées avec succès",
      });
      
      setClientSecret('');
      setRefreshToken('');
      await fetchAmazonData();
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleTestAmazon = async () => {
    setAmazonTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-token-manager');
      
      if (error) throw error;
      
      // Parser les erreurs normalisées
      if (data && !data.success && data.code) {
        setLastErrorCode(data.code); // Capturer le code d'erreur
        let userMessage = data.error;
        let suggestion = '';
        
        switch (data.code) {
          case 'INVALID_CLIENT':
            suggestion = '\n\n💡 Vérifiez votre Client ID et Client Secret dans Amazon Seller Central (Apps & Services → Develop Apps).';
            break;
          case 'INVALID_GRANT':
            suggestion = '\n\n💡 Votre Refresh Token a expiré. Générez-en un nouveau depuis Amazon Seller Central.';
            break;
          case 'UNAUTHORIZED_CLIENT':
            suggestion = '\n\n💡 Votre application Amazon n\'est PAS autorisée :\n' +
                        '1. Vérifiez que l\'application est "Published" (pas Draft)\n' +
                        '2. Vérifiez que le scope "refresh_token" est activé\n' +
                        '3. Générez un NOUVEAU Refresh Token après avoir corrigé';
            break;
          case 'CREDENTIALS_MISSING':
          case 'CREDENTIALS_INCOMPLETE':
            suggestion = '\n\n💡 Remplissez tous les champs : Client ID, Client Secret et Refresh Token.';
            break;
          case 'OAUTH_ERROR':
            suggestion = '\n\n💡 Erreur OAuth générique. Vérifiez les logs pour plus de détails.';
            break;
        }
        
        toast({
          title: "❌ Erreur Amazon",
          description: userMessage + suggestion,
          variant: "destructive",
        });
        return;
      }
      
      // Succès
      if (data?.access_token) {
        toast({
          title: "✅ Connexion Amazon réussie",
          description: "Token généré avec succès. Configuration valide.",
        });
      }
    } catch (error) {
      console.error('Amazon test error:', error);
      toast({
        title: "❌ Erreur de test Amazon",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAmazonTesting(false);
    }
  };

  const handleRotateAmazon = async () => {
    setAmazonRotating(true);
    try {
      const { data, error } = await supabase.functions.invoke('rotate-amazon-credentials');
      
      if (error) throw error;
      
      if (data?.error === 'manual_rotation_required') {
        toast({
          title: "⚠️ Rotation manuelle requise",
          description: data.message,
        });
        // Could open a dialog with instructions here
        return;
      }
      
      if (data?.success) {
        toast({
          title: "✅ Rotation réussie",
          description: `Nouvelles credentials valides jusqu'au ${new Date(data.expires_at).toLocaleDateString('fr-FR')}`,
        });
        await fetchAmazonData();
      }
    } catch (error) {
      console.error('Amazon rotation error:', error);
      toast({
        title: "❌ Erreur de rotation",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAmazonRotating(false);
    }
  };

  const handleAuthorizeAmazon = async () => {
    if (!appId) {
      toast({
        title: "❌ App ID requis",
        description: "Veuillez saisir votre SP-API App ID",
        variant: "destructive",
      });
      return;
    }

    setAmazonAuthorizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-oauth-start', {
        body: { appId, region }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Ouvrir la page de consentement Amazon
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Amazon authorization error:', error);
      toast({
        title: "❌ Erreur d'autorisation",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
      setAmazonAuthorizing(false);
    }
  };

  const getDaysUntilExpiry = () => {
    if (!secretExpiresAt) return null;
    const expiryDate = new Date(secretExpiresAt);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = () => {
    const daysLeft = getDaysUntilExpiry();
    if (daysLeft === null) return null;
    
    if (daysLeft < 0) return { color: 'destructive', text: 'Expiré', icon: AlertCircle };
    if (daysLeft <= 30) return { color: 'destructive', text: `Expire dans ${daysLeft} jours`, icon: AlertCircle };
    if (daysLeft <= 60) return { color: 'default', text: `Expire dans ${daysLeft} jours`, icon: AlertCircle };
    return { color: 'secondary', text: `Valide ${daysLeft} jours`, icon: CheckCircle };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Configuration Amazon Seller API</h2>
          <p className="text-muted-foreground">
            Gérez vos credentials Amazon Selling Partner API
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Configuration Amazon Seller API
            </CardTitle>
            <CardDescription>
              Credentials pour accéder à l'API Amazon Selling Partner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AmazonHealthStatus />
            
            {/* Section OAuth recommandée */}
            <Alert className="border-primary">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Méthode recommandée :</strong> Utilisez le bouton "Autoriser avec Amazon" ci-dessous pour configurer automatiquement vos credentials via OAuth.
              </AlertDescription>
            </Alert>

            {/* Section Configuration OAuth - Informations importantes */}
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Info className="h-4 w-4" />
                Informations de Configuration OAuth
              </h3>
              
              {/* RDT Delegation Switch */}
              <div className="space-y-2 p-3 bg-white dark:bg-gray-900 rounded border">
                <Label htmlFor="rdt" className="font-semibold">Restricted Data Token (RDT)</Label>
                <div className="flex items-start space-x-3">
                  <Switch
                    id="rdt"
                    checked={rdtDelegation}
                    onCheckedChange={setRdtDelegation}
                  />
                  <div className="flex-1">
                    <Label htmlFor="rdt" className="font-normal cursor-pointer">
                      Déléguer l'accès aux PII (Personally Identifiable Information) à l'application d'un autre développeur
                    </Label>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      ⚠️ N'activez cette option que si vous autorisez explicitement une application tierce à accéder aux données personnelles via le Restricted Data Token
                    </p>
                  </div>
                </div>
              </div>

              {/* OAuth URIs */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  URIs à configurer dans Amazon Seller Central
                </h4>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">URI de redirection OAuth</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/amazon-oauth-callback"
                      className="font-mono text-xs bg-white dark:bg-gray-900"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText('https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/amazon-oauth-callback');
                        toast({ title: "✅ Copié", description: "URI de redirection copiée" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    📋 Ajoutez cette URI dans : Seller Central → Apps & Services → Develop Apps → Edit App → OAuth Redirect URIs
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">URI de connexion OAuth (Login URI)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={
                        region === 'EU' 
                          ? 'https://sellercentral-europe.amazon.com/apps/authorize/consent'
                          : region === 'NA'
                          ? 'https://sellercentral.amazon.com/apps/authorize/consent'
                          : 'https://sellercentral.amazon.co.jp/apps/authorize/consent'
                      }
                      className="font-mono text-xs bg-white dark:bg-gray-900"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const loginUri = region === 'EU' 
                          ? 'https://sellercentral-europe.amazon.com/apps/authorize/consent'
                          : region === 'NA'
                          ? 'https://sellercentral.amazon.com/apps/authorize/consent'
                          : 'https://sellercentral.amazon.co.jp/apps/authorize/consent';
                        navigator.clipboard.writeText(loginUri);
                        toast({ title: "✅ Copié", description: "URI de connexion copiée" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    🔗 URI utilisée pour l'autorisation OAuth (calculée automatiquement selon la région sélectionnée)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Autorisation OAuth Amazon
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="app-id">SP-API App ID *</Label>
                  <Input
                    id="app-id"
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="amzn1.sp.solution.xxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Depuis Seller Central → Apps & Services → Develop Apps
                  </p>
                </div>

                <div>
                  <Label htmlFor="region">Région</Label>
                  <Select value={region} onValueChange={(value: 'EU' | 'NA' | 'FE') => setRegion(value)}>
                    <SelectTrigger id="region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EU">Europe (EU)</SelectItem>
                      <SelectItem value="NA">Amérique du Nord (NA)</SelectItem>
                      <SelectItem value="FE">Extrême-Orient (FE)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAuthorizeAmazon}
                disabled={amazonAuthorizing || !appId}
                className="w-full"
                size="lg"
              >
                <ExternalLink className={`mr-2 h-4 w-4 ${amazonAuthorizing ? 'animate-pulse' : ''}`} />
                {amazonAuthorizing ? "Redirection en cours..." : "🔐 Autoriser avec Amazon"}
              </Button>
            </div>

            <AmazonSetupGuide errorCode={lastErrorCode} />
            
            {clientId && (
              <div className="space-y-2">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Amazon Seller API configuré et actif
                  </AlertDescription>
                </Alert>
                
                {secretExpiresAt && (() => {
                  const status = getExpiryStatus();
                  if (!status) return null;
                  const IconComponent = status.icon;
                  
                  return (
                    <Alert variant={status.color as any}>
                      <IconComponent className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Client Secret: {status.text}</span>
                        {getDaysUntilExpiry() !== null && getDaysUntilExpiry()! <= 60 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRotateAmazon}
                            disabled={amazonRotating}
                          >
                            <RefreshCw className={`mr-2 h-3 w-3 ${amazonRotating ? 'animate-spin' : ''}`} />
                            {amazonRotating ? 'Rotation...' : 'Rotation des credentials'}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  );
                })()}
                
                {lastRotationAt && (
                  <p className="text-xs text-muted-foreground">
                    Dernière rotation: {new Date(lastRotationAt).toLocaleDateString('fr-FR')} à {new Date(lastRotationAt).toLocaleTimeString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="client-id">Client ID *</Label>
                <Input
                  id="client-id"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="amzn1.application-oa2-client.xxx"
                />
              </div>

              <div>
                <Label htmlFor="client-secret">Client Secret *</Label>
                <div className="flex gap-2">
                  <Input
                    id="client-secret"
                    type={showAmazonSecrets ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="amzn1.oa2-cs.v1.xxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAmazonSecrets(!showAmazonSecrets)}
                  >
                    {showAmazonSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="refresh-token">Refresh Token *</Label>
                <Input
                  id="refresh-token"
                  type={showAmazonSecrets ? "text" : "password"}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Atzr|xxx"
                />
              </div>

              <div>
                <Label htmlFor="marketplace-id">Marketplace ID</Label>
                <Input
                  id="marketplace-id"
                  type="text"
                  value={marketplaceId}
                  onChange={(e) => setMarketplaceId(e.target.value)}
                  placeholder="A13V1IB3VIYZZH"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  France: A13V1IB3VIYZZH | US: ATVPDKIKX0DER
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveAmazon}
                  disabled={amazonLoading}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {amazonLoading ? "Sauvegarde..." : "💾 Sauvegarder"}
                </Button>
                <Button
                  onClick={handleTestAmazon}
                  disabled={amazonTesting || !clientId}
                  variant="outline"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${amazonTesting ? 'animate-spin' : ''}`} />
                  🧪 Tester
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {process.env.NODE_ENV === 'development' && <AmazonErrorTester />}
    </div>
  );
};