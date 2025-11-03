import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, BookOpen, Zap, AlertTriangle } from "lucide-react";
import { MCPFaq } from "./MCPFaq";

export const MCPDocumentation = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Documentation MCP
          </CardTitle>
          <CardDescription>
            Guide complet pour utiliser les intégrations MCP (Model Context Protocol)
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="odoo">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="odoo">Odoo</TabsTrigger>
          <TabsTrigger value="prestashop">PrestaShop</TabsTrigger>
          <TabsTrigger value="amazon">Amazon</TabsTrigger>
        </TabsList>

        <TabsContent value="odoo">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏢 Odoo MCP
                <Badge variant="outline">100 appels/h</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Connectez votre instance Odoo pour synchroniser vos produits, commandes et clients via XML-RPC.
                </AlertDescription>
              </Alert>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Configuration requise
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>URL de votre instance Odoo (ex: https://votre-domaine.odoo.com)</li>
                  <li>Nom de la base de données</li>
                  <li>Nom d'utilisateur (email)</li>
                  <li>Mot de passe ou API Key</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Outils disponibles</h4>
                <div className="space-y-2">
                  <div className="border rounded-lg p-3">
                    <code className="text-sm font-mono">list_products</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Liste les produits Odoo avec limite configurable (défaut: 10)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Args: <code>limit</code> (optionnel)
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <code className="text-sm font-mono">search_products</code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recherche des produits par nom, marque ou catégorie
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Args: <code>search</code>, <code>brand</code> (optionnels)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Erreurs courantes
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">Odoo authentication failed</code>
                    <p className="text-muted-foreground mt-1">
                      ➜ Vérifiez vos credentials (username, password, database)
                    </p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">Rate limit exceeded</code>
                    <p className="text-muted-foreground mt-1">
                      ➜ Vous avez atteint la limite de 100 appels/heure. Attendez la réinitialisation.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Exemples de commandes</h4>
                <div className="space-y-2">
                  <div className="bg-muted p-3 rounded-lg">
                    <code className="text-sm">📦 Liste-moi les 10 derniers produits Odoo</code>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <code className="text-sm">🔍 Recherche tous les produits Sony dans Odoo</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prestashop">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🛒 PrestaShop MCP
                <Badge variant="outline">50 appels/h</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Intégration PrestaShop via API REST pour gérer votre catalogue e-commerce.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amazon">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📦 Amazon SP-API
                <Badge variant="outline">20 appels/h</Badge>
                <Badge variant="destructive">Limites strictes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  L'API Amazon a des limites très strictes. Utilisez avec parcimonie.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MCPFaq />
    </div>
  );
};
