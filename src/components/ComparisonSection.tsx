import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

export const ComparisonSection = () => {
  const { t } = useTranslation();

  const features = [
    "aiPowered",
    "realtime",
    "odooIntegration",
    "batchAnalysis",
    "priceMonitoring",
    "marketIntelligence",
    "support",
    "updates",
    "customization",
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {t("comparison.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("comparison.subtitle")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-primary/20">
                <th className="text-left py-4 px-6 text-muted-foreground font-normal">
                  Fonctionnalités
                </th>
                <th className="text-center py-4 px-6 bg-primary/10 rounded-t-lg">
                  <div className="font-bold text-primary text-lg">
                    {t("comparison.us")}
                  </div>
                </th>
                <th className="text-center py-4 px-6 text-muted-foreground">
                  {t("comparison.others")}
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature}
                  className="border-b border-border animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <td className="py-4 px-6 text-foreground">
                    {t(`comparison.features.${feature}`)}
                  </td>
                  <td className="py-4 px-6 text-center bg-primary/5">
                    <Check className="h-6 w-6 text-primary inline-block" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    {index < 5 ? (
                      <Check className="h-6 w-6 text-muted-foreground/50 inline-block" />
                    ) : (
                      <X className="h-6 w-6 text-destructive/50 inline-block" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
