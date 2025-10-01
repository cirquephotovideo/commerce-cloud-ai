import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

export const TestimonialsSection = () => {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: "Sophie Martin",
      role: "CEO, TechStore Paris",
      content: "Cette plateforme a transformé notre façon de gérer nos prix. +42% de marge en 3 mois grâce à l'IA.",
      rating: 5,
      image: "👩‍💼",
    },
    {
      name: "Marc Dubois",
      role: "Directeur E-commerce, SportShop",
      content: "L'intégration Odoo est magique. Fini les exports/imports manuels. Gain de temps colossal.",
      rating: 5,
      image: "👨‍💻",
    },
    {
      name: "Claire Bernard",
      role: "Chef Produit, BeautyLine",
      content: "Les analyses de marché sont d'une précision incroyable. On anticipe les tendances avant nos concurrents.",
      rating: 5,
      image: "👩‍🔬",
    },
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {t("testimonials.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="relative overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-all hover-scale shadow-[var(--shadow-card)]"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  ))}
                </div>
                <p className="text-foreground mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{testimonial.image}</div>
                  <div>
                    <div className="font-semibold text-foreground">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
