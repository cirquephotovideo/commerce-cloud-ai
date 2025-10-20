import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import heroBg from "@/assets/hero-bg.jpg";

export const HeroSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  const handleAnalyzeClick = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="AI E-commerce Background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16 lg:py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6 md:space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">🚀 L'IA qui automatise votre e-commerce de A à Z</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight px-2 sm:px-4">
            Gagnez 40h/mois sur la gestion produits
          </h1>

          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-muted-foreground max-w-3xl mx-auto px-2 sm:px-4">
            De l'import fournisseur à l'export plateformes : analysez, optimisez et synchronisez vos catalogues en temps réel. 0 manipulation manuelle.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 px-2 sm:px-4">
            <Button 
              size="lg"
              className="text-base sm:text-lg shadow-glow hover:shadow-glow transition-all w-full sm:w-auto"
              onClick={() => navigate("/pricing")}
            >
              <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              {t("hero.ctaTrial")}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-base sm:text-lg border-primary/20 hover:border-primary/40 backdrop-blur-sm w-full sm:w-auto"
              onClick={handleAnalyzeClick}
            >
              <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              {t("hero.ctaAnalyze")}
            </Button>
            <Button 
              size="lg"
              variant="ghost"
              className="text-base sm:text-lg backdrop-blur-sm w-full sm:w-auto"
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
            >
              📹 Voir la démo (2min)
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 md:gap-6 pt-6 sm:pt-8 md:pt-12 max-w-4xl mx-auto px-2 sm:px-4">
            <div className="space-y-1 sm:space-y-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-4 md:p-6">
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">{t("hero.metric1")}</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Précision</div>
            </div>
            <div className="space-y-1 sm:space-y-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-4 md:p-6">
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-secondary">40h</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Économisées/mois</div>
            </div>
            <div className="space-y-1 sm:space-y-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-4 md:p-6">
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-accent">{t("hero.metric3")}</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Temps analyse</div>
            </div>
            <div className="space-y-1 sm:space-y-2 bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-4 md:p-6">
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">12.5K</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Clients actifs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated gradient orbs - hidden on mobile */}
      <div className="hidden md:block absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="hidden md:block absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    </section>
  );
};
