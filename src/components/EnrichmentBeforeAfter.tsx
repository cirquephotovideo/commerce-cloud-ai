import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export const EnrichmentBeforeAfter = () => {
  const { t } = useTranslation();

  const beforeFeatures = [
    { text: 'Description: "Smartphone 128Go noir"', icon: X, color: "text-destructive" },
    { text: "Specs: Aucune", icon: X, color: "text-destructive" },
    { text: "Images: 1 photo basse qualité", icon: X, color: "text-destructive" },
    { text: "Prix: 599€ (marge inconnue)", icon: X, color: "text-destructive" }
  ];

  const afterFeatures = [
    { text: "Description SEO: 250 mots optimisés", icon: Check, color: "text-primary" },
    { text: "Specs: 47 caractéristiques extraites", icon: Check, color: "text-primary" },
    { text: "Images: 8 photos HD Amazon", icon: Check, color: "text-primary" },
    { text: "Prix recommandé: 649€ (marge 18.5%)", icon: Check, color: "text-primary" }
  ];

  const stats = [
    { value: "30s", label: "Temps d'enrichissement", color: "text-primary" },
    { value: "47", label: "Specs extraites", color: "text-secondary" },
    { value: "94/100", label: "Score qualité", color: "text-accent" },
    { value: "+127%", label: "Taux de conversion", color: "text-primary" }
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            L'IA transforme vos fiches produits
          </h2>
          <p className="text-xl text-muted-foreground">
            De la fiche basique à la fiche optimisée : 30 secondes chrono
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* AVANT */}
          <Card className="border-2 border-destructive/30">
            <CardHeader className="bg-destructive/10">
              <CardTitle className="flex items-center gap-2">
                <X className="h-5 w-5 text-destructive" />
                Fiche Basique (Import brut)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="aspect-video bg-muted/30 rounded-lg border mb-4 flex items-center justify-center">
                <p className="text-muted-foreground text-center px-4">
                  Screenshot : Fiche produit avant enrichissement
                </p>
              </div>
              <div className="space-y-2 text-sm">
                {beforeFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${feature.color}`} />
                      <span className="text-muted-foreground">{feature.text}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* APRÈS */}
          <Card className="border-2 border-primary/30 shadow-lg">
            <CardHeader className="bg-primary/10">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Fiche Enrichie (IA + Amazon)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border mb-4 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Sparkles className="h-16 w-16 mx-auto text-primary/40" />
                  <p className="text-muted-foreground text-sm px-4">
                    Screenshot : Fiche produit après enrichissement
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {afterFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${feature.color}`} />
                      <span className={feature.color}>{feature.text}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats d'enrichissement */}
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {stats.map((stat, index) => (
                <div key={index}>
                  <div className={`text-3xl md:text-4xl font-bold ${stat.color} mb-2`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
