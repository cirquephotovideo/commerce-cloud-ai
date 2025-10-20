import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Truck, Store, Package, Database, Cloud, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

export const PlatformExportShowcase = () => {
  const { t } = useTranslation();

  const platforms = [
    { icon: ShoppingBag, name: "Shopify" },
    { icon: Truck, name: "PrestaShop" },
    { icon: Store, name: "WooCommerce" },
    { icon: Package, name: "Odoo" },
    { icon: Database, name: "Magento" },
    { icon: Cloud, name: "Salesforce" }
  ];

  return (
    <section className="py-24 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Exportez vers 12 plateformes en 1 clic
          </h2>
          <p className="text-xl text-muted-foreground">
            Shopify, PrestaShop, WooCommerce, Odoo, Magento... 
            <br />
            Synchronisation bidirectionnelle automatique.
          </p>
        </div>

        {/* Export Menu Screenshot */}
        <div className="mb-12">
          <Card className="max-w-4xl mx-auto overflow-hidden border-2 border-primary/20 shadow-2xl">
            <div className="aspect-video overflow-hidden rounded-lg border">
              <img 
                src="/screenshots/export-platforms-menu.png" 
                alt="Menu d'export multi-plateformes avec synchronisation en 1 clic vers Shopify, WooCommerce, PrestaShop..."
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </Card>
        </div>

        {/* Platform Logos Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-items-center mb-12">
          {platforms.map((platform, index) => {
            const Icon = platform.icon;
            return (
              <div 
                key={index} 
                className="text-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div className="bg-muted/50 rounded-lg p-6 mb-2 hover:bg-muted transition-colors">
                  <Icon className="h-12 w-12 mx-auto" />
                </div>
                <span className="text-sm font-medium">{platform.name}</span>
              </div>
            );
          })}
        </div>

        {/* Additional platforms indicator */}
        <div className="text-center mb-12">
          <p className="text-muted-foreground mb-4">
            + 6 plateformes supplémentaires : SAP, WinDev, Deliveroo, Uber Eats, Just Eat, et plus...
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" variant="outline" className="gap-2">
            <Eye className="h-5 w-5" />
            Voir toutes les intégrations
          </Button>
        </div>
      </div>
    </section>
  );
};
