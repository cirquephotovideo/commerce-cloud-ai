import { useTranslation } from "react-i18next";
import { Shield, Lock, FileCheck, Headphones } from "lucide-react";

export const TrustSignalsSection = () => {
  const { t } = useTranslation();

  const signals = [
    {
      icon: Shield,
      title: t("trust.guarantee"),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Lock,
      title: t("trust.secure"),
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      icon: FileCheck,
      title: t("trust.gdpr"),
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Headphones,
      title: t("trust.support"),
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <section className="py-16 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <h3 className="text-2xl md:text-3xl font-bold mb-2">
            {t("trust.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {signals.map((signal, index) => {
            const Icon = signal.icon;
            return (
              <div
                key={index}
                className="flex flex-col items-center text-center animate-fade-in hover-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-16 h-16 rounded-full ${signal.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`h-8 w-8 ${signal.color}`} />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {signal.title}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
