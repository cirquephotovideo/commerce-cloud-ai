import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Globe, Brain, BarChart3 } from "lucide-react";

export const FeaturesSection = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Globe,
      title: "🔄 Automatisation Fournisseurs",
      items: [
        "Import automatique par email (IMAP/POP3)",
        "Import auto FTP/SFTP planifié",
        "Mapping intelligent des colonnes",
        "Détection pièces jointes (Excel/CSV)",
        "Historique des 3 derniers emails",
        "Nettoyage automatique anciens emails"
      ]
    },
    {
      icon: Brain,
      title: "🤖 Enrichissement IA Intelligent",
      items: [
        "Analyse complète en 30 secondes",
        "Génération descriptions SEO",
        "Extraction specs techniques",
        "Analyse marges & prix recommandés",
        "Recherche images Amazon automatique",
        "Compliance RSGP & certifications"
      ]
    },
    {
      icon: BarChart3,
      title: "🎯 Intelligence Marché & Export",
      items: [
        "Google Shopping comparaison temps réel",
        "Surveillance prix concurrents 24/7",
        "Alertes variations stock/prix",
        "Export 1-clic vers 12 plateformes",
        "Synchronisation bidirectionnelle",
        "Dashboard analytics avancé"
      ]
    }
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
            {t("features.title")}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            {t("features.subtitle")}
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
                <ul className="space-y-2">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2 text-sm sm:text-base text-muted-foreground">
                      <span className="text-primary mt-1 flex-shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
