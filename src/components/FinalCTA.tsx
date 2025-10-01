import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const FinalCTA = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-10 pointer-events-none" />
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, hsl(263 70% 60% / 0.15) 0%, transparent 50%)' }} />
      
      <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-8 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            14 jours d'essai gratuit • Sans carte bancaire
          </span>
        </div>

        <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
          {t("finalCta.title")}
        </h2>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          {t("finalCta.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="text-lg px-8 py-6 shadow-[var(--shadow-glow)] hover-scale group"
            onClick={() => navigate("/pricing")}
          >
            {t("finalCta.cta")}
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6"
            onClick={() => {
              const demoSection = document.getElementById("demo");
              demoSection?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Voir la Démo
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-8">
          {t("finalCta.guarantee")}
        </p>
      </div>
    </section>
  );
};
