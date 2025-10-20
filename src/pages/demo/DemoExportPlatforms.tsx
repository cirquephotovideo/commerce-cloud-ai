import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Truck, Store, Package, Database, Cloud, Server, Code, UtensilsCrossed, CheckCircle, AlertCircle, Clock } from "lucide-react";

export const DemoExportPlatforms = () => {
  const platforms = [
    {
      icon: ShoppingBag,
      name: "Shopify",
      connected: true,
      lastSync: "Il y a 2h",
      productsCount: 247,
      color: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      icon: Truck,
      name: "PrestaShop",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-pink-600",
      bgColor: "bg-pink-500/10"
    },
    {
      icon: Store,
      name: "WooCommerce",
      connected: true,
      lastSync: "Il y a 5h",
      productsCount: 198,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: Package,
      name: "Odoo",
      connected: true,
      lastSync: "Il y a 1h",
      productsCount: 156,
      color: "text-red-600",
      bgColor: "bg-red-500/10"
    },
    {
      icon: Database,
      name: "Magento",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10"
    },
    {
      icon: Cloud,
      name: "Salesforce",
      connected: true,
      lastSync: "Il y a 3h",
      productsCount: 342,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: Server,
      name: "SAP",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-cyan-600",
      bgColor: "bg-cyan-500/10"
    },
    {
      icon: Code,
      name: "WinDev",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-indigo-600",
      bgColor: "bg-indigo-500/10"
    },
    {
      icon: UtensilsCrossed,
      name: "Deliveroo",
      connected: true,
      lastSync: "Il y a 4h",
      productsCount: 89,
      color: "text-teal-600",
      bgColor: "bg-teal-500/10"
    },
    {
      icon: UtensilsCrossed,
      name: "Uber Eats",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-lime-600",
      bgColor: "bg-lime-500/10"
    },
    {
      icon: UtensilsCrossed,
      name: "Just Eat",
      connected: false,
      lastSync: "-",
      productsCount: 0,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10"
    },
    {
      icon: Code,
      name: "API Custom",
      connected: true,
      lastSync: "Il y a 6h",
      productsCount: 124,
      color: "text-gray-600",
      bgColor: "bg-gray-500/10"
    }
  ];

  const recentExports = [
    {
      platform: "Shopify",
      products: 247,
      status: "success",
      statusLabel: "Succès",
      date: "Il y a 2h",
      errors: 0
    },
    {
      platform: "Odoo",
      products: 156,
      status: "success",
      statusLabel: "Succès",
      date: "Il y a 1h",
      errors: 0
    },
    {
      platform: "WooCommerce",
      products: 98,
      status: "partial",
      statusLabel: "Partiel",
      date: "Il y a 5h",
      errors: 3
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Succès
        </Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Partiel
        </Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Erreur
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Plateformes d'export</h2>
        <p className="text-muted-foreground">Synchronisation en 1 clic vers 12 plateformes e-commerce</p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">12</p>
              <p className="text-sm text-muted-foreground mt-1">Plateformes disponibles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">5</p>
              <p className="text-sm text-muted-foreground mt-1">Connectées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">1,156</p>
              <p className="text-sm text-muted-foreground mt-1">Produits synchronisés</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">98.9%</p>
              <p className="text-sm text-muted-foreground mt-1">Taux de succès</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platforms Grid */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
        {platforms.map((platform, index) => {
          const Icon = platform.icon;
          return (
            <Card 
              key={index} 
              className={`hover:shadow-lg transition-all cursor-pointer ${
                platform.connected ? 'border-green-500/30' : 'border-muted'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-3 rounded-lg ${platform.bgColor}`}>
                    <Icon className={`h-6 w-6 ${platform.color}`} />
                  </div>
                  {platform.connected ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardTitle className="text-base">{platform.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {platform.connected ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Produits</span>
                      <Badge variant="secondary" className="font-mono">
                        {platform.productsCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{platform.lastSync}</span>
                    </div>
                    <Badge className="w-full bg-green-500/10 text-green-600 border-green-500/20 justify-center">
                      ✅ Connecté
                    </Badge>
                  </div>
                ) : (
                  <Badge className="w-full bg-muted text-muted-foreground justify-center">
                    ⚠️ Non configuré
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Exports Log */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers exports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Plateforme</th>
                  <th className="text-center p-4 font-medium">Produits</th>
                  <th className="text-center p-4 font-medium">Statut</th>
                  <th className="text-center p-4 font-medium">Erreurs</th>
                  <th className="text-center p-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentExports.map((exportLog, index) => (
                  <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{exportLog.platform}</td>
                    <td className="p-4 text-center">
                      <Badge variant="outline" className="font-mono">
                        {exportLog.products}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        {getStatusBadge(exportLog.status)}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {exportLog.errors > 0 ? (
                        <Badge variant="destructive">{exportLog.errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-sm text-muted-foreground">
                      {exportLog.date}
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
