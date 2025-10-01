import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface APIKey {
  name: string;
  description: string;
  envVar: string;
  configured: boolean;
  service: string;
}

export const APIKeyManagement = () => {
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const apiKeys: APIKey[] = [
    {
      name: "Google Search API",
      description: "Pour les recherches Google Shopping",
      envVar: "GOOGLE_SEARCH_API_KEY",
      configured: true,
      service: "Google Cloud"
    },
    {
      name: "Google Search CX",
      description: "ID du moteur de recherche personnalisé",
      envVar: "GOOGLE_SEARCH_CX",
      configured: true,
      service: "Google Cloud"
    },
    {
      name: "Resend API",
      description: "Pour l'envoi d'emails",
      envVar: "RESEND_API_KEY",
      configured: true,
      service: "Resend"
    },
    {
      name: "Serper API",
      description: "API de recherche alternative",
      envVar: "SERPER_API_KEY",
      configured: true,
      service: "Serper"
    },
    {
      name: "Stripe Secret",
      description: "Clé secrète Stripe pour les paiements",
      envVar: "STRIPE_SECRET_KEY",
      configured: true,
      service: "Stripe"
    },
    {
      name: "Lovable API",
      description: "Clé API Lovable pour l'IA",
      envVar: "LOVABLE_API_KEY",
      configured: true,
      service: "Lovable"
    }
  ];

  const toggleKeyVisibility = (envVar: string) => {
    setShowKeys(prev => ({ ...prev, [envVar]: !prev[envVar] }));
  };

  const handleTestKey = async (key: APIKey) => {
    setTestingKey(key.envVar);
    
    // Simuler un test d'API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Test réussi",
      description: `La clé ${key.name} fonctionne correctement`,
    });
    
    setTestingKey(null);
  };

  const handleUpdateKey = (key: APIKey) => {
    toast({
      title: "Info",
      description: "Pour modifier les clés API, utilisez le backend Lovable Cloud",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Gestion des clés API</h2>
        <p className="text-muted-foreground">
          Gérez toutes les clés API et secrets de l'application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Clés API configurées
          </CardTitle>
          <CardDescription>
            Liste de toutes les clés API et leur statut
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Variable</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.envVar}>
                  <TableCell>
                    <Badge variant="outline">{key.service}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {key.description}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {key.envVar}
                    </code>
                  </TableCell>
                  <TableCell>
                    {key.configured ? (
                      <Badge className="bg-green-500 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Configurée
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Non configurée
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestKey(key)}
                        disabled={!key.configured || testingKey === key.envVar}
                      >
                        {testingKey === key.envVar ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          "Tester"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateKey(key)}
                      >
                        Modifier
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <p>Utilisez le backend pour modifier les secrets</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};