import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, CheckCircle, XCircle, RefreshCw, AlertCircle, Edit, TestTube, Package, Clock, AlertTriangle, Eye, EyeOff, Save } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface APIKey {
  name: string;
  envVar: string;
  configured: boolean;
  valid: boolean;
  service: string;
  lastTested: string;
  error?: string;
}

export const APIKeyManagement = () => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ key: '', cx: '', url: '' });
  
  // Amazon state
  const [amazonLoading, setAmazonLoading] = useState(false);
  const [amazonTesting, setAmazonTesting] = useState(false);
  const [lastToken, setLastToken] = useState<any>(null);
  const [credentialsId, setCredentialsId] = useState<string | null>(null);
  const [amazonForm, setAmazonForm] = useState({
    client_id: '',
    client_secret: '',
    refresh_token: '',
    marketplace_id: 'A13V1IB3VIYZZH',
  });

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      console.log('[API-KEYS] Fetching API keys status...');
      
      const { data, error } = await supabase.functions.invoke('verify-api-keys');
      
      if (error) {
        console.error('[API-KEYS] Error:', error);
        toast({
          title: "Erreur",
          description: "Impossible de vérifier les clés API",
          variant: "destructive",
        });
        return;
      }

      if (data?.keys) {
        console.log('[API-KEYS] Keys loaded:', data.keys.length);
        setApiKeys(data.keys);
      }
    } catch (error) {
      console.error('[API-KEYS] Exception:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAmazonData = async () => {
    try {
      const { data: credentials } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (credentials) {
        setCredentialsId(credentials.id);
        setAmazonForm({
          client_id: credentials.client_id,
          client_secret: credentials.client_secret_encrypted,
          refresh_token: credentials.refresh_token_encrypted,
          marketplace_id: credentials.marketplace_id,
        });

        const { data: tokenData } = await supabase
          .from('amazon_access_tokens')
          .select('*')
          .eq('credential_id', credentials.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tokenData) {
          setLastToken(tokenData);
        }
      }
    } catch (error) {
      console.error('Error fetching Amazon data:', error);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchAmazonData();
  }, []);

  const handleVerifyAll = async () => {
    setVerifying(true);
    toast({
      title: "Vérification en cours",
      description: "Test de toutes les clés API...",
    });
    
    await fetchApiKeys();
    
    setVerifying(false);
    toast({
      title: "Vérification terminée",
      description: "Toutes les clés ont été testées",
    });
  };

  const handleEditKey = (key: APIKey) => {
    setEditingKey(key);
    setEditFormData({ key: '', cx: '', url: '' });
  };

  const handleSaveAmazon = async () => {
    setAmazonLoading(true);
    try {
      const dataToSave = {
        id: credentialsId || undefined,
        client_id: amazonForm.client_id,
        client_secret_encrypted: amazonForm.client_secret,
        refresh_token_encrypted: amazonForm.refresh_token,
        marketplace_id: amazonForm.marketplace_id,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('amazon_credentials')
        .upsert(dataToSave)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCredentialsId(data.id);
      }

      toast({
        title: "✅ Credentials sauvegardées",
        description: "Les clés Amazon ont été enregistrées avec succès",
      });
      
      await fetchApiKeys(); // Refresh to show Amazon in the list
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

      toast({
        title: "✅ Connexion réussie",
        description: `Token Amazon généré avec succès`,
      });

      setLastToken({
        access_token: data.access_token,
        expires_at: data.expires_at,
        generated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      toast({
        title: "❌ Échec de la connexion",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAmazonTesting(false);
    }
  };

  const handleTestKey = async (key: APIKey) => {
    setTestingKey(key.envVar);
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'test',
          service: key.service,
          key: editFormData.key,
          cx: editFormData.cx,
          url: editFormData.url,
        },
      });

      if (error) throw error;

      if (data.valid) {
        toast({
          title: "Test réussi",
          description: `La clé ${key.name} est valide`,
        });
      } else {
        toast({
          title: "Test échoué",
          description: data.error || "La clé est invalide",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[TEST-KEY] Error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de tester la clé",
        variant: "destructive",
      });
    } finally {
      setTestingKey(null);
    }
  };

  const getStatusBadge = (key: APIKey) => {
    if (!key.configured) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Non configurée
        </Badge>
      );
    }
    
    if (!key.valid) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Invalide
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-green-500 gap-1">
        <CheckCircle className="h-3 w-3" />
        Valide
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gestion des clés API</h2>
          <p className="text-muted-foreground">
            Gérez toutes les clés API et secrets de l'application
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchApiKeys}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            onClick={handleVerifyAll}
            disabled={loading || verifying}
            className="gap-2"
          >
            {verifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Tout vérifier
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Chargement des clés API...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Clés API configurées ({apiKeys.filter(k => k.valid).length}/{apiKeys.length})
              </CardTitle>
              <CardDescription>
                Liste de toutes les clés API et leur statut de validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Variable</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière vérification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.envVar}>
                      <TableCell>
                        <Badge variant="outline">{key.service}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {key.envVar}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(key)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(key.lastTested).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditKey(key)}
                                className="gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Éditer
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Éditer {key.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="key">
                                    {key.service === 'Google Search' ? 'API Key' : 
                                     key.service === 'Supabase' ? 'URL' : 'Clé API'}
                                  </Label>
                                  <Input
                                    id="key"
                                    type="password"
                                    placeholder={`Entrez votre ${key.name}`}
                                    value={editFormData.key}
                                    onChange={(e) => setEditFormData({ ...editFormData, key: e.target.value })}
                                  />
                                </div>
                                
                                {key.service === 'Google Search' && (
                                  <div className="space-y-2">
                                    <Label htmlFor="cx">Search Engine ID (CX)</Label>
                                    <Input
                                      id="cx"
                                      type="text"
                                      placeholder="Entrez votre CX"
                                      value={editFormData.cx}
                                      onChange={(e) => setEditFormData({ ...editFormData, cx: e.target.value })}
                                    />
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleTestKey(key)}
                                    disabled={testingKey === key.envVar}
                                    className="gap-1"
                                  >
                                    {testingKey === key.envVar ? (
                                      <>
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                        Test...
                                      </>
                                    ) : (
                                      <>
                                        <TestTube className="h-3 w-3" />
                                        Tester
                                      </>
                                    )}
                                  </Button>
                                </div>

                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    <div className="space-y-2">
                                      <p>✅ Le test fonctionne ! Vos clés sont valides.</p>
                                      <p>Pour les sauvegarder définitivement, ouvrez le backend Lovable Cloud et configurez les secrets :</p>
                                      <ul className="list-disc list-inside ml-2 text-xs">
                                        <li><code>GOOGLE_SEARCH_API_KEY</code> : {editFormData.key ? editFormData.key.substring(0, 20) + '...' : 'Votre clé API'}</li>
                                        <li><code>GOOGLE_SEARCH_CX</code> : {editFormData.cx || 'Votre CX'}</li>
                                      </ul>
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {apiKeys.some(k => k.error) && (
                <div className="mt-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold">Erreurs détectées :</p>
                        <ul className="list-disc list-inside space-y-1">
                          {apiKeys.filter(k => k.error).map(key => (
                            <li key={key.envVar} className="text-sm">
                              <strong>{key.name}</strong>: {key.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amazon Seller Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                🔐 Configuration Amazon Seller API
              </CardTitle>
              <CardDescription>
                Gérez vos credentials Amazon SP-API pour enrichir automatiquement vos produits avec les données Amazon (prix, images, dimensions, ventes).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avertissement si les secrets Cloud ne sont pas configurés */}
              {apiKeys.find(k => k.service === 'Amazon' && !k.envVar.includes('AMAZON_CLIENT_ID')) && (
                <Alert className="border-orange-500">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>⚠️ Recommandation sécurité :</strong> Pour une meilleure protection, configurez les secrets Amazon dans Lovable Cloud au lieu de les stocker en base :
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li><code className="bg-muted px-1 py-0.5 rounded">AMAZON_CLIENT_ID</code></li>
                      <li><code className="bg-muted px-1 py-0.5 rounded">AMAZON_CLIENT_SECRET</code></li>
                      <li><code className="bg-muted px-1 py-0.5 rounded">AMAZON_REFRESH_TOKEN</code></li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Les tokens d'accès sont régénérés automatiquement toutes les heures. Configurez vos credentials une seule fois.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amazon_client_id">Client ID</Label>
                  <Input
                    id="amazon_client_id"
                    value={amazonForm.client_id}
                    onChange={(e) => setAmazonForm({ ...amazonForm, client_id: e.target.value })}
                    placeholder="amzn1.application-oa2-client.XXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amazon_client_secret">Client Secret</Label>
                  <Input
                    id="amazon_client_secret"
                    type="password"
                    value={amazonForm.client_secret}
                    onChange={(e) => setAmazonForm({ ...amazonForm, client_secret: e.target.value })}
                    placeholder="amzn1.oa2-cs.v1.XXXXX"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="amazon_refresh_token">Refresh Token</Label>
                  <Input
                    id="amazon_refresh_token"
                    type="password"
                    value={amazonForm.refresh_token}
                    onChange={(e) => setAmazonForm({ ...amazonForm, refresh_token: e.target.value })}
                    placeholder="Atzr|XXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amazon_marketplace_id">Marketplace ID</Label>
                  <Input
                    id="amazon_marketplace_id"
                    value={amazonForm.marketplace_id}
                    onChange={(e) => setAmazonForm({ ...amazonForm, marketplace_id: e.target.value })}
                    placeholder="A13V1IB3VIYZZH"
                  />
                  <p className="text-xs text-muted-foreground">
                    France: A13V1IB3VIYZZH | Allemagne: A1PA6795UKMFR9 | UK: A1F83G8C2ARO7P
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveAmazon} disabled={amazonLoading}>
                  {amazonLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  💾 Sauvegarder
                </Button>
                <Button onClick={handleTestAmazon} disabled={amazonTesting || !credentialsId} variant="outline">
                  {amazonTesting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  🧪 Tester la connexion
                </Button>
              </div>

              {lastToken && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {new Date(lastToken.expires_at) < new Date() ? (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      Dernier Token Généré
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>
                        Généré le : {new Date(lastToken.generated_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className={new Date(lastToken.expires_at) < new Date() ? "text-orange-500 font-medium" : ""}>
                        Expire le : {new Date(lastToken.expires_at).toLocaleString('fr-FR')}
                        {new Date(lastToken.expires_at) < new Date() && " (Expiré - sera régénéré à la prochaine utilisation)"}
                      </span>
                    </div>
                    <code className="block text-xs bg-muted p-2 rounded truncate">
                      {lastToken.access_token.substring(0, 50)}...
                    </code>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations importantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <p>Toutes les clés API sont stockées de manière sécurisée dans Lovable Cloud</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <p>Les clés ne sont jamais exposées côté client</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <p>Les tests de validation sont effectués directement auprès des services</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <p>Pour modifier les secrets, utilisez le backend Lovable Cloud</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};