import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Check, Clock, FileText, Star, TrendingUp } from "lucide-react";

export const DemoProductComparison = () => {
  const beforeFeatures = [
    { label: "Description", value: "Basique", icon: X, color: "text-red-600" },
    { label: "Spécifications", value: "Aucune", icon: X, color: "text-red-600" },
    { label: "Images", value: "1 photo", icon: X, color: "text-red-600" },
    { label: "SEO", value: "Non optimisé", icon: X, color: "text-red-600" },
  ];

  const afterFeatures = [
    { label: "Description", value: "250 mots SEO", icon: Check, color: "text-green-600" },
    { label: "Spécifications", value: "47 attributs", icon: Check, color: "text-green-600" },
    { label: "Images", value: "8 photos HD", icon: Check, color: "text-green-600" },
    { label: "SEO", value: "Score 94/100", icon: Check, color: "text-green-600" },
  ];

  const specs = [
    { category: "Écran", value: "6.1\" Super Retina XDR OLED" },
    { category: "Processeur", value: "Apple A17 Pro (3nm)" },
    { category: "Caméra principale", value: "48MP + 12MP + 12MP" },
    { category: "Caméra frontale", value: "12MP TrueDepth" },
    { category: "Batterie", value: "3274 mAh" },
    { category: "RAM", value: "8 GB" },
    { category: "Stockage", value: "128 GB" },
    { category: "5G", value: "Oui" },
    { category: "WiFi", value: "WiFi 6E" },
    { category: "Bluetooth", value: "5.3" },
    { category: "NFC", value: "Oui" },
    { category: "Résistance", value: "IP68" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Enrichissement IA : Avant / Après</h2>
        <p className="text-muted-foreground">Comparaison d'une fiche produit enrichie par l'IA</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* BEFORE */}
        <Card className="border-red-500/30">
          <CardHeader className="bg-red-500/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">❌ Fiche Basique</CardTitle>
              <Badge variant="destructive">Non enrichi</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
                <img 
                  src="https://via.placeholder.com/400x300/cccccc/666666?text=Photo+basse+qualité" 
                  alt="Produit non enrichi"
                  className="w-full h-full object-cover rounded-lg opacity-60"
                />
              </div>
              <h3 className="font-bold text-lg mb-2">iPhone 15 Pro 128GB Noir</h3>
              <p className="text-sm text-muted-foreground mb-4">Smartphone Apple</p>
              <div className="space-y-2">
                {beforeFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{feature.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{feature.value}</span>
                        <Icon className={`h-4 w-4 ${feature.color}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Prix</span>
                  <span className="text-xl font-bold">599€</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AFTER */}
        <Card className="border-green-500/30">
          <CardHeader className="bg-green-500/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">✅ Fiche Enrichie</CardTitle>
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Score IA : 94/100</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <img 
                      src={`https://via.placeholder.com/150/4CAF50/ffffff?text=HD+${i}`}
                      alt={`Photo ${i}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                ))}
              </div>
              <h3 className="font-bold text-lg mb-2">
                Apple iPhone 15 Pro 128GB Noir - 6.1" Super Retina XDR, Puce A17 Pro, Triple Caméra 48MP
              </h3>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                <p className="text-sm leading-relaxed">
                  Le nouvel iPhone 15 Pro redéfinit l'excellence mobile avec sa puce A17 Pro gravée en 3nm, 
                  son écran Super Retina XDR de 6.1 pouces et son système photo révolutionnaire avec capteur principal 48MP. 
                  Profitez de performances exceptionnelles, d'une autonomie optimisée et d'un design en titane ultra-premium.
                </p>
              </div>
              <div className="space-y-2">
                {afterFeatures.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 border rounded bg-green-500/5">
                      <span className="text-sm">{feature.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{feature.value}</span>
                        <Icon className={`h-4 w-4 ${feature.color}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Prix recommandé IA</span>
                  <span className="text-xl font-bold">649€</span>
                </div>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  Marge : 18.5%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Specifications Accordion */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Spécifications complètes extraites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {specs.map((spec, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium">{spec.category}</span>
                <span className="text-sm text-muted-foreground">{spec.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">30s</p>
                <p className="text-xs text-muted-foreground">Temps de traitement</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">47</p>
                <p className="text-xs text-muted-foreground">Specs extraites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">94/100</p>
                <p className="text-xs text-muted-foreground">Score qualité</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">+127%</p>
                <p className="text-xs text-muted-foreground">Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
