import { Card } from "@/components/ui/card";
import { Globe, Brain, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Recherche Web Intégrée",
    description: "Accès aux informations les plus récentes via la recherche web automatique"
  },
  {
    icon: Brain,
    title: "IA Avancée",
    description: "Modèles d'IA de dernière génération pour des analyses précises"
  },
  {
    icon: BarChart3,
    title: "Analyse Complète",
    description: "9 outils spécialisés pour analyser tous les aspects de vos produits"
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-12 sm:py-16 md:py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
            Pourquoi Choisir Notre Plateforme ?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Des outils puissants pour optimiser votre e-commerce avec l'intelligence artificielle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="bg-gradient-card border-border backdrop-blur-sm p-6 sm:p-8 space-y-3 sm:space-y-4 hover:shadow-glow transition-all"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">{feature.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
