import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ProblemsToSolutions = () => {
  const { t } = useTranslation();

  const comparisons = [
    {
      before: {
        title: "Import manuel CSV",
        time: "4h/jour",
        icon: "📝"
      },
      after: {
        title: "Import automatique",
        time: "5 min/semaine",
        icon: "🤖"
      }
    },
    {
      before: {
        title: "Prix désynchronisés",
        time: "Perte de ventes",
        icon: "💸"
      },
      after: {
        title: "Sync temps réel",
        time: "24/7 automatique",
        icon: "⚡"
      }
    },
    {
      before: {
        title: "Enrichissement manuel",
        time: "15min/produit",
        icon: "✍️"
      },
      after: {
        title: "IA automatique",
        time: "30sec/produit",
        icon: "✨"
      }
    }
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Avant / Après Tarifique
          </h2>
          <p className="text-xl text-muted-foreground">
            Transformez votre e-commerce en quelques clics
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {comparisons.map((comparison, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-destructive/10 border-b-2 border-destructive/20">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <X className="h-5 w-5" />
                  AVANT
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">{comparison.before.icon}</div>
                  <h3 className="font-semibold text-lg mb-2">{comparison.before.title}</h3>
                  <p className="text-muted-foreground">{comparison.before.time}</p>
                </div>

                <div className="border-t-2 border-dashed pt-6">
                  <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/20">
                    <div className="flex items-center gap-2 text-primary font-semibold mb-3">
                      <Check className="h-5 w-5" />
                      APRÈS
                    </div>
                    <div className="text-center">
                      <div className="text-3xl mb-2">{comparison.after.icon}</div>
                      <h3 className="font-semibold mb-1">{comparison.after.title}</h3>
                      <p className="text-sm text-muted-foreground">{comparison.after.time}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
