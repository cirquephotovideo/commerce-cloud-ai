import { useTranslation } from "react-i18next";
import { TrendingUp, Users, Package, Smile } from "lucide-react";

export const StatsSection = () => {
  const { t } = useTranslation();

  const stats = [
    {
      icon: Users,
      value: "12,547",
      label: t("stats.clients"),
      color: "text-primary",
    },
    {
      icon: Package,
      value: "2.4M+",
      label: t("stats.analyzed"),
      color: "text-secondary",
    },
    {
      icon: TrendingUp,
      value: "18.5M",
      label: t("stats.saved"),
      color: "text-accent",
    },
    {
      icon: Smile,
      value: "98.7%",
      label: t("stats.satisfaction"),
      color: "text-primary",
    },
  ];

  return (
    <section className="py-20 px-4 bg-card/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-hero)] opacity-20 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("stats.title")}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
