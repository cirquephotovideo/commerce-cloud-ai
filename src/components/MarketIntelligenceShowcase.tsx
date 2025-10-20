import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, TrendingUp, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

export const MarketIntelligenceShowcase = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: ShoppingCart,
      title: "Google Shopping Scraping",
      description: "Comparaison de 47 marchands pour chaque produit. Positionnement en temps réel.",
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      title: "Surveillance Prix 24/7",
      description: "Alertes immédiates si un concurrent baisse ses prix. Historique sur 90 jours.",
      color: "text-secondary"
    },
    {
      icon: Target,
      title: "Recommandations IA",
      description: "Suggestions de prix optimaux basées sur 15M de datapoints. ROI garanti.",
      color: "text-accent"
    }
  ];

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-secondary/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Surveillez le marché en temps réel
          </h2>
          <p className="text-xl text-muted-foreground">
            Vos concurrents changent leurs prix ? Soyez alerté instantanément.
          </p>
        </div>

        {/* Dashboard Screenshot */}
        <div className="mb-12">
          <Card className="overflow-hidden border-2 border-secondary/20 shadow-2xl">
            <div className="aspect-video bg-gradient-to-br from-secondary/10 to-accent/10 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <TrendingUp className="h-24 w-24 mx-auto text-secondary/40" />
                <p className="text-muted-foreground">
                  Capture d'écran : Dashboard Market Intelligence
                  <br />
                  <span className="text-sm">avec surveillance des prix concurrents en temps réel</span>
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Icon className={`h-8 w-8 ${feature.color} mb-2`} />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
