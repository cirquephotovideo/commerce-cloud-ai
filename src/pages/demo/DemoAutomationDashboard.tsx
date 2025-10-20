import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, Trash2, Sparkles, FileOutput, RefreshCw, Link2, Settings, TrendingUp, Play, Pause, Trash } from "lucide-react";

export const DemoAutomationDashboard = () => {
  const categories = [
    {
      icon: FileUp,
      name: "Import",
      totalRules: 3,
      activeRules: 2,
      successRate: 98.7,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: Trash2,
      name: "Cleanup",
      totalRules: 1,
      activeRules: 1,
      successRate: 100,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: Sparkles,
      name: "Enrichment",
      totalRules: 5,
      activeRules: 4,
      successRate: 94.2,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10"
    },
    {
      icon: FileOutput,
      name: "Export",
      totalRules: 2,
      activeRules: 2,
      successRate: 96.5,
      color: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      icon: RefreshCw,
      name: "Sync",
      totalRules: 4,
      activeRules: 3,
      successRate: 99.1,
      color: "text-cyan-600",
      bgColor: "bg-cyan-500/10"
    },
    {
      icon: Link2,
      name: "Linking",
      totalRules: 2,
      activeRules: 1,
      successRate: 92.3,
      color: "text-pink-600",
      bgColor: "bg-pink-500/10"
    }
  ];

  const activeRules = [
    {
      id: 1,
      name: "Import Email FVS Distribution",
      type: "Import",
      supplier: "FVS Distribution",
      frequency: "Quotidien à 06:00",
      lastExecution: "Il y a 2h",
      status: "active",
      successRate: 98.7,
      totalExecutions: 156
    },
    {
      id: 2,
      name: "Enrichissement Auto Smartphones",
      type: "Enrichment",
      supplier: "Tous",
      frequency: "En temps réel",
      lastExecution: "Il y a 15min",
      status: "active",
      successRate: 95.3,
      totalExecutions: 2847
    },
    {
      id: 3,
      name: "Export Shopify Nuit",
      type: "Export",
      supplier: "-",
      frequency: "Quotidien à 02:00",
      lastExecution: "Il y a 14h",
      status: "active",
      successRate: 96.5,
      totalExecutions: 89
    },
    {
      id: 4,
      name: "Liaison Automatique Produits",
      type: "Linking",
      supplier: "Tous",
      frequency: "Toutes les 4h",
      lastExecution: "Il y a 1h",
      status: "paused",
      successRate: 92.3,
      totalExecutions: 456
    },
    {
      id: 5,
      name: "Sync Stock WooCommerce",
      type: "Sync",
      supplier: "-",
      frequency: "Toutes les heures",
      lastExecution: "Il y a 45min",
      status: "active",
      successRate: 99.1,
      totalExecutions: 1234
    },
    {
      id: 6,
      name: "Cleanup Doublons Quotidien",
      type: "Cleanup",
      supplier: "Tous",
      frequency: "Quotidien à 03:00",
      lastExecution: "Il y a 13h",
      status: "error",
      successRate: 88.2,
      totalExecutions: 67
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">✅ Active</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">⏸️ Pause</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">❌ Erreur</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Gestionnaire d'automatisations</h2>
        <p className="text-muted-foreground">Vue d'ensemble de vos règles d'automatisation actives</p>
      </div>

      {/* Category Overview */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {categories.map((category, index) => {
          const Icon = category.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${category.bgColor}`}>
                    <Icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {category.activeRules}/{category.totalRules}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-bold text-lg mb-2">{category.name}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taux de succès</span>
                  <span className="font-bold text-green-600">{category.successRate}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-xs text-muted-foreground">Imports réussis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">98.7%</p>
                <p className="text-xs text-muted-foreground">Taux de succès</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <RefreshCw className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">2.3s</p>
                <p className="text-xs text-muted-foreground">Temps moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Règles actives</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Nom</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Fournisseur</th>
                  <th className="text-left p-4 font-medium">Fréquence</th>
                  <th className="text-left p-4 font-medium">Dernière exec.</th>
                  <th className="text-center p-4 font-medium">Statut</th>
                  <th className="text-center p-4 font-medium">Stats</th>
                  <th className="text-center p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRules.map((rule) => (
                  <tr key={rule.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{rule.name}</td>
                    <td className="p-4">
                      <Badge variant="outline">{rule.type}</Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{rule.supplier}</td>
                    <td className="p-4 text-sm">{rule.frequency}</td>
                    <td className="p-4 text-sm text-muted-foreground">{rule.lastExecution}</td>
                    <td className="p-4 text-center">
                      {getStatusBadge(rule.status)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="text-sm">
                        <p className="font-bold text-green-600">{rule.successRate}%</p>
                        <p className="text-xs text-muted-foreground">{rule.totalExecutions} exec.</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="ghost">
                          {rule.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
