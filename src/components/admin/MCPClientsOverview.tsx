import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, CheckCircle2, XCircle, Settings, FileText, TestTube, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MCPCallLogs } from "./MCPCallLogs";
import { MCPConnectionTests } from "./MCPConnectionTests";
import { MCPMonitoringWidget } from "./MCPMonitoringWidget";
import { MCPDocumentation } from "./MCPDocumentation";
import { MCPRateLimitDisplay } from "./MCPRateLimitDisplay";

// Types de plateformes avec icônes
const PLATFORM_ICONS: Record<string, string> = {
  odoo: "🏢",
  prestashop: "🛒",
  shopify: "🛍️",
  woocommerce: "🌐",
  magento: "🎁",
  "amazon-seller-mcp": "📦",
  gmail: "📧",
  salesforce: "☁️",
  sap: "💼",
  windev: "💻",
  deliveroo: "🍕",
  uber_eats: "🍔",
  just_eat: "🍽️",
};

export const MCPClientsOverview = () => {
  const { toast } = useToast();

  // Fetch des configurations
  const { data: platforms, isLoading, refetch } = useQuery({
    queryKey: ['mcp-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Statistiques
  const stats = {
    total: platforms?.length || 0,
    active: platforms?.filter(p => p.is_active).length || 0,
    inactive: platforms?.filter(p => !p.is_active).length || 0,
    byType: platforms?.reduce((acc, p) => {
      acc[p.platform_type] = (acc[p.platform_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  const togglePlatformStatus = async (platformId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('platform_configurations')
        .update({ is_active: !currentStatus })
        .eq('id', platformId);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `La plateforme est maintenant ${!currentStatus ? 'active' : 'inactive'}`,
      });

      refetch();
    } catch (error) {
      console.error('Error toggling platform status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut de la plateforme",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/4 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Clients MCP Actifs</h2>
        <p className="text-muted-foreground">
          Gérez vos connexions aux plateformes e-commerce et services
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[900px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Tests
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="documentation" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documentation
          </TabsTrigger>
        </TabsList>

        {/* Onglet Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-6">
          {/* Rate Limits Display */}
          {platforms && platforms.length > 0 && (
            <MCPRateLimitDisplay platforms={platforms} />
          )}

          {/* Cartes de statistiques */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plateformes</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Toutes les intégrations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Actives</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  En service
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactives</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Hors service
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tableau des plateformes */}
          <Card>
            <CardHeader>
              <CardTitle>Plateformes Configurées</CardTitle>
            </CardHeader>
            <CardContent>
              {platforms && platforms.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plateforme</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dernière MAJ</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platforms.map((platform) => (
                      <TableRow key={platform.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{PLATFORM_ICONS[platform.platform_type] || "🔌"}</span>
                            <span className="capitalize">{platform.platform_type.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {platform.platform_url || "Non configuré"}
                        </TableCell>
                        <TableCell>
                          {platform.is_active ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(platform.updated_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => togglePlatformStatus(platform.id, platform.is_active)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucune plateforme configurée</p>
                  <p className="text-sm">Configurez vos premières intégrations pour commencer</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Logs d'appels */}
        <TabsContent value="logs">
          <MCPCallLogs />
        </TabsContent>

        {/* Onglet Tests de connexion */}
        <TabsContent value="tests">
          <MCPConnectionTests />
        </TabsContent>

        {/* Onglet Monitoring */}
        <TabsContent value="monitoring">
          <MCPMonitoringWidget />
        </TabsContent>

        {/* Onglet Documentation */}
        <TabsContent value="documentation">
          <MCPDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
};
