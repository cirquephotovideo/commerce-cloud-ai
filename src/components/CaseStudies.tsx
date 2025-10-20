import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Quote, TrendingUp, Zap, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

export const CaseStudies = () => {
  const { t } = useTranslation();

  const cases = [
    {
      company: "TechStore Paris",
      industry: "Électronique",
      avatar: "TS",
      metric: "+42%",
      metricLabel: "marge en 3 mois",
      quote: "1247 produits enrichis en 2 jours. L'automatisation nous a fait gagner 35h/semaine.",
      icon: TrendingUp,
      color: "text-primary"
    },
    {
      company: "FashionHub Lyon",
      industry: "Mode & Textile",
      avatar: "FH",
      metric: "98.7%",
      metricLabel: "taux de succès",
      quote: "La synchronisation automatique avec nos 5 fournisseurs est parfaite. Plus d'erreurs de stock.",
      icon: Zap,
      color: "text-secondary"
    },
    {
      company: "HomeDecor Lille",
      industry: "Décoration",
      avatar: "HD",
      metric: "4 min",
      metricLabel: "pour 250 produits",
      quote: "L'enrichissement IA est bluffant. Nos fiches produits sont maintenant au niveau des grands sites.",
      icon: Target,
      color: "text-accent"
    }
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ils ont transformé leur e-commerce
          </h2>
          <p className="text-xl text-muted-foreground">
            Découvrez comment nos clients réussissent avec Tarifique
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {cases.map((caseStudy, index) => {
            const Icon = caseStudy.icon;
            return (
              <Card key={index} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {caseStudy.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{caseStudy.company}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {caseStudy.industry}
                      </Badge>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-4 rounded-lg bg-muted/50 border`}>
                    <Icon className={`h-8 w-8 ${caseStudy.color}`} />
                    <div>
                      <div className={`text-3xl font-bold ${caseStudy.color}`}>
                        {caseStudy.metric}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {caseStudy.metricLabel}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="relative">
                    <Quote className="h-8 w-8 text-primary/20 absolute -top-2 -left-2" />
                    <p className="text-muted-foreground italic pl-6">
                      {caseStudy.quote}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            + 12 544 autres clients qui automatisent leur e-commerce avec Tarifique
          </p>
        </div>
      </div>
    </section>
  );
};
