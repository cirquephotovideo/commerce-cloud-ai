import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

export const HeroSection = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
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
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Intelligence Artificielle pour l'E-commerce</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-tight px-4">
            Optimisez Votre 
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Commerce </span>
            avec l'IA
          </h1>

          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto px-4">
            Analysez vos produits, chattez avec l'IA et optimisez votre stratégie commerciale 
            avec la puissance de l'intelligence artificielle et de la recherche web en temps réel.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 px-4">
            <Button 
              size="lg"
              className="text-base sm:text-lg shadow-glow hover:shadow-glow transition-all w-full sm:w-auto"
              onClick={() => scrollToSection('chat')}
            >
              <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Essayer le Chat IA
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-base sm:text-lg border-primary/20 hover:border-primary/40 backdrop-blur-sm w-full sm:w-auto"
              onClick={() => scrollToSection('analyzer')}
            >
              <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Analyser un Produit
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 pt-8 sm:pt-12 max-w-2xl mx-auto px-4">
            <div className="space-y-1 sm:space-y-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">9</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Outils d'Analyse</div>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary">100%</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Alimenté par l'IA</div>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-accent">24/7</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Disponible</div>
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
