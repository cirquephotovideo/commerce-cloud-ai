import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AmazonConfiguration = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastToken, setLastToken] = useState<any>(null);
  const [credentialsId, setCredentialsId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    refresh_token: '',
    marketplace_id: 'A13V1IB3VIYZZH',
  });

  // Charger les credentials existants
  useEffect(() => {
    const fetchData = async () => {
      // Charger credentials
      const { data: credentials } = await supabase
        .from('amazon_credentials')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (credentials) {
        setCredentialsId(credentials.id);
        setFormData({
          client_id: credentials.client_id,
          client_secret: credentials.client_secret_encrypted,
          refresh_token: credentials.refresh_token_encrypted,
          marketplace_id: credentials.marketplace_id,
        });

        // Charger le dernier token
        const { data: tokenData } = await supabase
          .from('amazon_access_tokens')
          .select('*')
          .eq('credential_id', credentials.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tokenData) {
          setLastToken(tokenData);
        }
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const dataToSave = {
        id: credentialsId || undefined,
        client_id: formData.client_id,
        client_secret_encrypted: formData.client_secret,
        refresh_token_encrypted: formData.refresh_token,
        marketplace_id: formData.marketplace_id,
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
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-token-manager');

      if (error) throw error;

      toast({
        title: "✅ Connexion réussie",
        description: `Token généré avec succès`,
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
      setTesting(false);
    }
  };

  const isTokenExpired = lastToken ? new Date(lastToken.expires_at) < new Date() : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Configuration Amazon Seller API
          </CardTitle>
          <CardDescription>
            Gérez vos credentials Amazon SP-API. Les tokens d'accès sont régénérés automatiquement toutes les heures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ces credentials permettent d'enrichir automatiquement vos produits avec les données Amazon (prix, images, dimensions, ventes).
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                placeholder="amzn1.application-oa2-client.XXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_secret">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                placeholder="amzn1.oa2-cs.v1.XXXXX"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="refresh_token">Refresh Token</Label>
              <Input
                id="refresh_token"
                type="password"
                value={formData.refresh_token}
                onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                placeholder="Atzr|XXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketplace_id">Marketplace ID</Label>
              <Input
                id="marketplace_id"
                value={formData.marketplace_id}
                onChange={(e) => setFormData({ ...formData, marketplace_id: e.target.value })}
                placeholder="A13V1IB3VIYZZH"
              />
              <p className="text-xs text-muted-foreground">
                France: A13V1IB3VIYZZH | Allemagne: A1PA6795UKMFR9 | UK: A1F83G8C2ARO7P
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Sauvegarder
            </Button>
            <Button onClick={handleTestConnection} disabled={testing || !credentialsId} variant="outline">
              {testing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Tester la connexion
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isTokenExpired ? (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
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
              <span className={isTokenExpired ? "text-orange-500 font-medium" : ""}>
                Expire le : {new Date(lastToken.expires_at).toLocaleString('fr-FR')}
                {isTokenExpired && " (Expiré - sera régénéré à la prochaine utilisation)"}
              </span>
            </div>
            <code className="block text-xs bg-muted p-2 rounded truncate">
              {lastToken.access_token.substring(0, 50)}...
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
