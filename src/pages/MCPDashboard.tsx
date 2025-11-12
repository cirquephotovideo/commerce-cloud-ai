import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Settings, Activity } from "lucide-react";
import { useMCPContext } from "@/contexts/MCPContext";

const MCPDashboard = () => {
  const { mcpPackages, isLoading } = useMCPContext();

  const activePlatforms = mcpPackages.filter(pkg => pkg.isConfigured);
  const availablePlatforms = mcpPackages.filter(pkg => !pkg.isConfigured);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plug className="h-8 w-8 text-primary" />
            MCP Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos connexions aux plateformes externes via Model Context Protocol
          </p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Plateformes Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activePlatforms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur {mcpPackages.length} disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outils MCP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {activePlatforms.reduce((acc, pkg) => acc + (pkg.tools?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Outils disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statut Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={activePlatforms.length > 0 ? "default" : "secondary"}>
              {activePlatforms.length > 0 ? "✅ Connecté" : "⏸️ Inactif"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {isLoading ? "Chargement..." : "Prêt"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Plateformes */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">✅ Actives ({activePlatforms.length})</TabsTrigger>
          <TabsTrigger value="available">📦 Disponibles ({availablePlatforms.length})</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activePlatforms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucune plateforme MCP active pour le moment.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Configurez vos plateformes dans l'onglet "Disponibles"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlatforms.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{pkg.icon}</span>
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      </div>
                      <Badge variant="default">Actif</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    
                    {pkg.tools && pkg.tools.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Outils disponibles :
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.tools.slice(0, 3).map((tool) => (
                            <Badge key={tool} variant="outline" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                          {pkg.tools.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{pkg.tools.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurer
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {availablePlatforms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Toutes les plateformes sont déjà configurées !
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlatforms.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{pkg.icon}</span>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    <Button className="w-full">
                      <Plug className="h-4 w-4 mr-2" />
                      Connecter
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration MCP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Qu'est-ce que MCP ?</h4>
                <p className="text-sm text-muted-foreground">
                  Model Context Protocol (MCP) permet à l'IA d'interagir avec vos plateformes externes
                  (Odoo, PrestaShop, Amazon, etc.) en utilisant leurs APIs via des outils standardisés.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Plateformes supportées</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Odoo - ERP et gestion commerciale</li>
                  <li>PrestaShop - E-commerce</li>
                  <li>Amazon SP-API - Marketplace</li>
                  <li>Et plus à venir...</li>
                </ul>
              </div>

              <div className="p-4 bg-muted rounded-lg mt-4">
                <p className="text-sm">
                  💡 <strong>Astuce :</strong> Une fois configurées, vos plateformes MCP 
                  peuvent être interrogées via le Chat MCP en langage naturel.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MCPDashboard;
