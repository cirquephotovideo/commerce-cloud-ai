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
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Intelligence Artificielle pour l'E-commerce</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            Optimisez Votre 
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Commerce </span>
            avec l'IA
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Analysez vos produits, chattez avec l'IA et optimisez votre stratégie commerciale 
            avec la puissance de l'intelligence artificielle et de la recherche web en temps réel.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg"
              className="text-lg shadow-glow hover:shadow-glow transition-all"
              onClick={() => scrollToSection('chat')}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Essayer le Chat IA
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-lg border-primary/20 hover:border-primary/40 backdrop-blur-sm"
              onClick={() => scrollToSection('analyzer')}
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              Analyser un Produit
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">9</div>
              <div className="text-sm text-muted-foreground">Outils d'Analyse</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-secondary">100%</div>
              <div className="text-sm text-muted-foreground">Alimenté par l'IA</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-accent">24/7</div>
              <div className="text-sm text-muted-foreground">Disponible</div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    </section>
  );
};
