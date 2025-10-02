import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Package, TrendingDown, Bell, GitCompare, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const AIMarketSuggestions = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const suggestions = [
    {
      icon: Package,
      title: "Bundle Intelligent",
      description: "L'IA suggère des produits complémentaires pour créer des offres groupées attractives",
      action: "Générer des bundles",
      color: "text-blue-600",
      route: "/batch-analyzer"
    },
    {
      icon: TrendingDown,
      title: "Meilleur Moment d'Achat",
      description: "Prédiction des baisses de prix basée sur l'historique et les tendances saisonnières",
      action: "Voir prédictions",
      color: "text-green-600",
      route: "/market-intelligence"
    },
    {
      icon: Bell,
      title: "Alerte Stock",
      description: "Notification instantanée quand un produit surveillé revient en stock",
      action: "Configurer alertes",
      color: "text-orange-600",
      route: "/market-intelligence"
    },
    {
      icon: GitCompare,
      title: "Comparaison Automatique",
      description: "Compare automatiquement 2-3 produits similaires pour identifier le meilleur choix",
      action: "Comparer produits",
      color: "text-purple-600",
      route: "/history"
    },
    {
      icon: Calendar,
      title: "Recommandations Saisonnières",
      description: "Tendances et opportunités selon la période (soldes, Black Friday, etc.)",
      action: "Voir tendances",
      color: "text-pink-600",
      route: "/market-intelligence"
    }
  ];

  const handleAction = async (suggestion: any) => {
    setLoading(true);
    if (suggestion.route) {
      navigate(suggestion.route);
      toast.success(`Redirection vers ${suggestion.title}`);
    } else {
      toast.info(`Fonctionnalité "${suggestion.title}" en cours de développement`);
    }
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            Suggestions IA - Fonctionnalités Créatives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((suggestion, idx) => (
              <Card key={idx} className="border-2 hover:border-primary transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-3 rounded-full bg-muted ${suggestion.color}`}>
                      <suggestion.icon className="h-6 w-6" />
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">{suggestion.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </p>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction(suggestion)}
                      disabled={loading}
                    >
                      {suggestion.action}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              À venir prochainement
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Analyse de sentiment des avis</Badge>
              <Badge variant="secondary">Prédiction de popularité</Badge>
              <Badge variant="secondary">Optimisation de prix dynamique</Badge>
              <Badge variant="secondary">Détection de produits tendance</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};