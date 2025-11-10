import { Card } from "@/components/ui/card";
import { Package, Boxes, ShoppingCart, TrendingUp } from "lucide-react";

export const GlobalProductStats = () => {
  // Note: Les statistiques réelles seront chargées par les onglets individuels
  // Cette version simplifiée évite les problèmes de typage TypeScript avec Supabase
  const statCards = [
    {
      title: "Produits Analysés",
      value: "-",
      icon: Package,
      color: "text-primary",
      description: "Voir l'onglet Produits Analysés",
    },
    {
      title: "Produits Fournisseurs",
      value: "-",
      icon: Boxes,
      color: "text-chart-2",
      description: "Voir l'onglet Produits Fournisseurs",
    },
    {
      title: "Enrichissements Amazon",
      value: "-",
      icon: ShoppingCart,
      color: "text-chart-3",
      description: "Voir l'onglet Enrichissements Amazon",
    },
    {
      title: "Liens Automatiques",
      value: "-",
      icon: TrendingUp,
      color: "text-chart-4",
      description: "Créés automatiquement par EAN",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </div>
              <Icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
};
