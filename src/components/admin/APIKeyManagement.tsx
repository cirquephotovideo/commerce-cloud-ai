import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, CheckCircle, XCircle, RefreshCw, AlertCircle, Edit, TestTube, Package, Cloud, Eye, EyeOff, Save } from "lucide-react";
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
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('A13V1IB3VIYZZH');
  const [showAmazonSecrets, setShowAmazonSecrets] = useState(false);

  // AWS States
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRoleArn, setAwsRoleArn] = useState('');
  const [awsRegion, setAwsRegion] = useState('eu-west-1');
  const [awsConfigured, setAwsConfigured] = useState(false);
  const [awsLastTest, setAwsLastTest] = useState<{ success: boolean; timestamp: string } | null>(null);
  const [showAwsKeys, setShowAwsKeys] = useState(false);
  const [testingAws, setTestingAws] = useState(false);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('verify-api-keys');
      
      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de vérifier les clés API",
          variant: "destructive",
        });
        return;
      }

      if (data?.keys) {
        setApiKeys(data.keys);
      }
    } catch (error) {
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
      const { data: credData } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (credData) {
        setClientId(credData.client_id || '');
        setMarketplaceId(credData.marketplace_id || '');
      }
    } catch (error) {
      console.error('Error fetching Amazon data:', error);
    }
  };

  const fetchAwsData = async () => {
    try {
      const { data } = await supabase
        .from('aws_credentials')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setAwsRoleArn(data.role_arn || '');
        setAwsRegion(data.region || 'eu-west-1');
        setAwsConfigured(true);
      }
    } catch (error) {
      console.error('Error fetching AWS data:', error);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchAmazonData();
    fetchAwsData();
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

  const handleTestKey = async (key: APIKey) => {
    setTestingKey(key.envVar);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          action: 'test',
          service: key.service.toLowerCase().replace(' ', '_'),
          key: editFormData.key,
          cx: editFormData.cx,
          url: editFormData.url,
        }
      });

      if (error) throw error;

      if (data?.valid) {
        toast({
          title: "✅ Test réussi",
          description: "La clé API est valide",
        });
      } else {
        toast({
          title: "❌ Test échoué",
          description: data?.error || "La clé API est invalide",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur de test",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingKey(null);
    }
  };

  const handleSaveAmazon = async () => {
    setAmazonLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('amazon_credentials')
        .upsert({
          user_id: user.id,
          client_id: clientId,
          client_secret_encrypted: clientSecret,
          refresh_token_encrypted: refreshToken,
          marketplace_id: marketplaceId,
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
      
      if (data?.access_token) {
        toast({
          title: "Connexion Amazon réussie",
          description: "Token d'accès généré avec succès",
        });
      }
    } catch (error) {
      console.error('Amazon test error:', error);
      toast({
        title: "Erreur de test Amazon",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAmazonTesting(false);
    }
  };

  const handleSaveAws = async () => {
    if (!awsAccessKeyId || !awsSecretAccessKey || !awsRoleArn) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs AWS requis",
        variant: "destructive",
      });
      return;
    }

    setAmazonLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('aws_credentials')
        .upsert({
          user_id: user.id,
          access_key_id_encrypted: awsAccessKeyId,
          secret_access_key_encrypted: awsSecretAccessKey,
          role_arn: awsRoleArn,
          region: awsRegion,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Credentials AWS sauvegardées",
        description: "Configuration AWS enregistrée avec succès",
      });

      setAwsConfigured(true);
      setAwsAccessKeyId('');
      setAwsSecretAccessKey('');
      fetchAwsData();
    } catch (error) {
      console.error('AWS save error:', error);
      toast({
        title: "Erreur de sauvegarde AWS",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAmazonLoading(false);
    }
  };

  const handleTestAws = async () => {
    setTestingAws(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-aws-sigv4');
      
      if (error) throw error;
      
      if (data?.success) {
        setAwsLastTest({ success: true, timestamp: new Date().toISOString() });
        toast({
          title: "Test AWS SigV4 réussi",
          description: "Connexion AWS et signature vérifiées",
        });
      } else {
        throw new Error(data?.error || 'Test échoué');
      }
    } catch (error) {
      console.error('AWS test error:', error);
      setAwsLastTest({ success: false, timestamp: new Date().toISOString() });
      toast({
        title: "Erreur de test AWS",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setTestingAws(false);
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
                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    Pour sauvegarder définitivement, ouvrez le backend et configurez les secrets.
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
            </CardContent>
          </Card>

          {/* Amazon Seller API Configuration */}
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
              {clientId && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Amazon Seller API configuré et actif
                  </AlertDescription>
                </Alert>
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

          {/* AWS Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Configuration AWS pour Amazon SP-API
              </CardTitle>
              <CardDescription>
                Credentials IAM AWS pour signer les requêtes Signature V4
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {awsConfigured && clientId ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    AWS configuré et actif. Les requêtes Amazon SP-API utilisent SigV4.
                  </AlertDescription>
                </Alert>
              ) : !clientId ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Configurez d'abord Amazon Seller API ci-dessus
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    AWS non configuré. Sans SigV4, les appels Amazon SP-API peuvent échouer.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="aws-access-key">AWS Access Key ID *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="aws-access-key"
                      type={showAwsKeys ? "text" : "password"}
                      value={awsAccessKeyId}
                      onChange={(e) => setAwsAccessKeyId(e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowAwsKeys(!showAwsKeys)}
                    >
                      {showAwsKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="aws-secret-key">AWS Secret Access Key *</Label>
                  <Input
                    id="aws-secret-key"
                    type={showAwsKeys ? "text" : "password"}
                    value={awsSecretAccessKey}
                    onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>

                <div>
                  <Label htmlFor="aws-role-arn">AWS Role ARN *</Label>
                  <Input
                    id="aws-role-arn"
                    type="text"
                    value={awsRoleArn}
                    onChange={(e) => setAwsRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/AmazonSPAPIRole"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
                  </p>
                </div>

                <div>
                  <Label htmlFor="aws-region">Région AWS</Label>
                  <select
                    id="aws-region"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="eu-west-1">EU West 1 (Irlande)</option>
                    <option value="us-east-1">US East 1 (Virginie)</option>
                    <option value="us-west-2">US West 2 (Oregon)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveAws}
                    disabled={amazonLoading}
                    className="flex-1"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {amazonLoading ? "Sauvegarde..." : "💾 Sauvegarder dans Cloud"}
                  </Button>
                  <Button
                    onClick={handleTestAws}
                    disabled={testingAws || !awsConfigured}
                    variant="outline"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${testingAws ? 'animate-spin' : ''}`} />
                    🧪 Tester SigV4
                  </Button>
                </div>

                {awsLastTest && (
                  <Alert variant={awsLastTest.success ? "default" : "destructive"}>
                    {awsLastTest.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      Dernier test: {awsLastTest.success ? "✅ Succès" : "❌ Échec"} - {new Date(awsLastTest.timestamp).toLocaleString()}
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Documentation:</strong> Créez un utilisateur IAM avec permissions <code>sts:AssumeRole</code> et attachez la politique Amazon SP-API au rôle cible.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
