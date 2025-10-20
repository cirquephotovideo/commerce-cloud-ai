import { Badge } from "@/components/ui/badge";

export const TrustBar = () => {
  const badges = [
    { icon: "✅", text: "RGPD Compliant" },
    { icon: "🔒", text: "Données cryptées" },
    { icon: "🛡️", text: "ISO 27001" },
    { icon: "⚡", text: "99.9% Uptime" },
    { icon: "⭐", text: "4.8/5 sur 2 547 avis" },
  ];

  return (
    <section className="py-8 px-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-y border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground font-medium">
            12 547 clients font confiance à Tarifique
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          {badges.map((badge, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className="px-4 py-2 text-sm bg-background/50 backdrop-blur-sm hover:bg-background transition-all"
            >
              <span className="mr-2">{badge.icon}</span>
              {badge.text}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
};
