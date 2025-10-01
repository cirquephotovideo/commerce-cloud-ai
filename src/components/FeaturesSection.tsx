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
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Pourquoi Choisir Notre Plateforme ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Des outils puissants pour optimiser votre e-commerce avec l'intelligence artificielle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="bg-gradient-card border-border backdrop-blur-sm p-8 space-y-4 hover:shadow-glow transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
                  <Icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
