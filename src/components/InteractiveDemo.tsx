import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, ShoppingCart, TrendingUp, Layers, Target, 
  Package, Image, Wrench, AlertTriangle, Check, Star,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";

export const InteractiveDemo = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("productAnalysis");

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {t("demo.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("demo.subtitle")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 w-full h-auto gap-2 bg-card/50 p-2 backdrop-blur-sm">
            <TabsTrigger value="productAnalysis" className="flex flex-col items-center gap-1 py-3">
              <Brain className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Analyse IA</span>
            </TabsTrigger>
            <TabsTrigger value="googleShopping" className="flex flex-col items-center gap-1 py-3">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Shopping</span>
            </TabsTrigger>
            <TabsTrigger value="priceMonitoring" className="flex flex-col items-center gap-1 py-3">
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Prix</span>
            </TabsTrigger>
            <TabsTrigger value="batchAnalysis" className="flex flex-col items-center gap-1 py-3">
              <Layers className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Lots</span>
            </TabsTrigger>
            <TabsTrigger value="marketIntelligence" className="flex flex-col items-center gap-1 py-3">
              <Target className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Marché</span>
            </TabsTrigger>
            <TabsTrigger value="odooIntegration" className="flex flex-col items-center gap-1 py-3">
              <Package className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Odoo</span>
            </TabsTrigger>
            <TabsTrigger value="imageOptimization" className="flex flex-col items-center gap-1 py-3">
              <Image className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Images</span>
            </TabsTrigger>
            <TabsTrigger value="technicalAnalysis" className="flex flex-col items-center gap-1 py-3">
              <Wrench className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Technique</span>
            </TabsTrigger>
            <TabsTrigger value="riskEvaluation" className="flex flex-col items-center gap-1 py-3">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs hidden lg:inline">Risques</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="productAnalysis" className="mt-8 animate-fade-in">
            <Card className="border-2 border-primary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-primary" />
                  Analyse Produit IA - iPhone 15 Pro
                </CardTitle>
                <CardDescription>Analyse complète générée par IA en 2,3 secondes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">94/100</div>
                    <div className="text-sm text-muted-foreground">Score Global</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border border-secondary/10">
                    <div className="text-3xl font-bold text-secondary mb-1">1.249€</div>
                    <div className="text-sm text-muted-foreground">Prix Recommandé</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border border-accent/10">
                    <div className="text-3xl font-bold text-accent mb-1">18.5%</div>
                    <div className="text-sm text-muted-foreground">Marge Suggérée</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Forte demande détectée : +127% de recherches ce mois</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Prix compétitif : 8% sous la moyenne marché (1.359€)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Mots-clés optimisés : 89% de pertinence SEO</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="googleShopping" className="mt-8 animate-fade-in">
            <Card className="border-2 border-secondary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6 text-secondary" />
                  Google Shopping - MacBook Pro M3
                </CardTitle>
                <CardDescription>Comparaison temps réel de 47 marchands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { merchant: "Amazon.fr", price: 2399, rating: 4.8, stock: "En stock" },
                    { merchant: "Fnac", price: 2449, rating: 4.7, stock: "2 restants", isYou: true },
                    { merchant: "Boulanger", price: 2499, rating: 4.6, stock: "En stock" },
                    { merchant: "Cdiscount", price: 2379, rating: 4.5, stock: "En stock" },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${item.isYou ? 'bg-secondary/10 border-secondary' : 'bg-muted/30 border-muted'}`}>
                      <div className="flex items-center gap-4">
                        <div className="font-semibold">{item.merchant}</div>
                        {item.isYou && <Badge variant="secondary">Vous</Badge>}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                          {item.rating}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{item.stock}</Badge>
                        <div className="text-xl font-bold">{item.price}€</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="priceMonitoring" className="mt-8 animate-fade-in">
            <Card className="border-2 border-accent/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-accent" />
                  Surveillance Prix - Nike Air Max
                </CardTitle>
                <CardDescription>Évolution sur 30 jours • 15 concurrents suivis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">149€</div>
                    <div className="text-sm text-muted-foreground">Prix Actuel</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive flex items-center justify-center gap-1">
                      <ArrowDownRight className="h-5 w-5" />
                      -12%
                    </div>
                    <div className="text-sm text-muted-foreground">vs Mois Dernier</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">135€</div>
                    <div className="text-sm text-muted-foreground">Prix Min Détecté</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">179€</div>
                    <div className="text-sm text-muted-foreground">Prix Max Détecté</div>
                  </div>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg border border-primary/10">
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong>Alerte Prix :</strong> Concurrent "SportZone" a baissé à 139€ il y a 2h. Recommandation : aligner ou différencier.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="batchAnalysis" className="mt-8 animate-fade-in">
            <Card className="border-2 border-primary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-6 w-6 text-primary" />
                  Analyse par Lots - 250 Produits Tech
                </CardTitle>
                <CardDescription>Traité en 4 min 32 sec • Économie de 12h de travail manuel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-primary/10 p-4 rounded-lg text-center border border-primary/20">
                      <div className="text-3xl font-bold text-primary">87%</div>
                      <div className="text-sm text-muted-foreground mt-1">Optimisables</div>
                    </div>
                    <div className="bg-secondary/10 p-4 rounded-lg text-center border border-secondary/20">
                      <div className="text-3xl font-bold text-secondary">43</div>
                      <div className="text-sm text-muted-foreground mt-1">Prix à Ajuster</div>
                    </div>
                    <div className="bg-accent/10 p-4 rounded-lg text-center border border-accent/20">
                      <div className="text-3xl font-bold text-accent">15K€</div>
                      <div className="text-sm text-muted-foreground mt-1">Gain Potentiel</div>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg text-center border border-muted">
                      <div className="text-3xl font-bold text-foreground">12</div>
                      <div className="text-sm text-muted-foreground mt-1">Ruptures Stock</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground text-center pt-2">
                    Export automatique vers Odoo • Génération de rapports PDF disponible
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marketIntelligence" className="mt-8 animate-fade-in">
            <Card className="border-2 border-secondary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-6 w-6 text-secondary" />
                  Intelligence Marché - Catégorie Smartphones
                </CardTitle>
                <CardDescription>Insights basés sur 15M de datapoints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-lg">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5 text-secondary" />
                    Tendance Émergente Détectée
                  </div>
                  <p className="text-sm text-muted-foreground">Les smartphones pliables connaissent une croissance de +234% de recherches ce trimestre. Opportunité de positionnement premium.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">43%</div>
                    <div className="text-sm text-muted-foreground">Part de marché Apple</div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">1.249€</div>
                    <div className="text-sm text-muted-foreground">Prix moyen segment</div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">8.5j</div>
                    <div className="text-sm text-muted-foreground">Rotation stock moyenne</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="odooIntegration" className="mt-8 animate-fade-in">
            <Card className="border-2 border-primary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-primary" />
                  Intégration Odoo - Synchronisation Active
                </CardTitle>
                <CardDescription>Dernière sync : il y a 3 minutes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Produits synchronisés</div>
                    <div className="text-3xl font-bold text-primary">1.247</div>
                  </div>
                  <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Mises à jour automatiques</div>
                    <div className="text-3xl font-bold text-secondary">89</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    <span>Prix synchronisés automatiquement</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    <span>Stock mis à jour en temps réel</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    <span>Images optimisées et uploadées</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    <span>Catégories mappées intelligemment</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imageOptimization" className="mt-8 animate-fade-in">
            <Card className="border-2 border-accent/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-6 w-6 text-accent" />
                  Optimisation Images - Automatique
                </CardTitle>
                <CardDescription>Compression intelligente + Génération IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="text-2xl font-bold text-accent">-67%</div>
                    <div className="text-sm text-muted-foreground mt-1">Réduction Taille</div>
                  </div>
                  <div className="text-center p-4 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="text-2xl font-bold text-accent">98/100</div>
                    <div className="text-sm text-muted-foreground mt-1">Score Qualité</div>
                  </div>
                  <div className="text-center p-4 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="text-2xl font-bold text-accent">+2.4s</div>
                    <div className="text-sm text-muted-foreground mt-1">Temps Chargement Gagné</div>
                  </div>
                </div>
                <div className="bg-muted/30 border border-muted p-4 rounded-lg">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avant :</span>
                      <span className="font-semibold">4.2 MB • 4000x3000px</span>
                    </div>
                    <div className="flex justify-between text-accent">
                      <span className="text-muted-foreground">Après :</span>
                      <span className="font-semibold">1.4 MB • 2000x1500px</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technicalAnalysis" className="mt-8 animate-fade-in">
            <Card className="border-2 border-primary/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-6 w-6 text-primary" />
                  Analyse Technique - Samsung Galaxy S24
                </CardTitle>
                <CardDescription>Spécifications extraites et vérifiées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">Processeur</span>
                      <span className="font-semibold">Snapdragon 8 Gen 3</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">RAM</span>
                      <span className="font-semibold">12 GB</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">Stockage</span>
                      <span className="font-semibold">256 GB</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">Écran</span>
                      <span className="font-semibold">6.2" AMOLED 120Hz</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">Batterie</span>
                      <span className="font-semibold">4000 mAh</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">5G</span>
                      <span className="font-semibold text-primary">Oui</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="riskEvaluation" className="mt-8 animate-fade-in">
            <Card className="border-2 border-destructive/20 shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  Évaluation Risques - Casque Beats Studio
                </CardTitle>
                <CardDescription>Analyse de risques commerciaux</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-5xl font-bold text-primary mb-2">7.8/10</div>
                  <div className="text-sm text-muted-foreground">Score de Sécurité Global</div>
                  <Badge variant="secondary" className="mt-2">Risque Faible</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 bg-primary/10 rounded border border-primary/20">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Demande Stable</div>
                      <div className="text-xs text-muted-foreground">Tendance positive sur 12 mois</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-primary/10 rounded border border-primary/20">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Marque Reconnue</div>
                      <div className="text-xs text-muted-foreground">Notoriété élevée, faible retour</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">Concurrence Forte</div>
                      <div className="text-xs text-muted-foreground">27 vendeurs actifs sur ce produit</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
