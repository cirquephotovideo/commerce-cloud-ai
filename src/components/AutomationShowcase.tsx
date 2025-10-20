import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, BarChart3, Play, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export const AutomationShowcase = () => {
  const { t } = useTranslation();

  const wizardSteps = [
    {
      number: "1️⃣",
      title: "Choisir le type d'import",
      description: "Import Email, FTP, API ou Nettoyage automatique"
    },
    {
      number: "2️⃣",
      title: "Configurer la source",
      description: "IMAP, POP3, FTP/SFTP ou webhook"
    },
    {
      number: "3️⃣",
      title: "Définir la fréquence",
      description: "Quotidien, hebdo, mensuel ou personnalisé"
    },
    {
      number: "4️⃣",
      title: "Actions automatiques",
      description: "Enrichissement IA + Export plateformes"
    }
  ];

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-background to-primary/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge className="mb-4 text-base px-4 py-2">🚀 NOUVELLE FONCTIONNALITÉ</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Automatisation Intelligente des Imports
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Fini les exports/imports manuels. Vos fournisseurs envoient leurs tarifs par email ?
            Tarifique les importe, les mappe et les enrichit automatiquement. 0 manipulation.
          </p>
        </div>

        {/* Email Inbox Preview */}
        <div className="mb-16 animate-fade-in">
          <Card className="overflow-hidden border-2 border-primary/20 shadow-2xl">
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-semibold">Inbox Fournisseurs</span>
                <Badge variant="secondary">7 emails détectés</Badge>
              </div>
            </div>
            <div className="aspect-video bg-muted/30 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <Mail className="h-24 w-24 mx-auto text-primary/40" />
                <p className="text-muted-foreground">
                  Capture d'écran : Interface de gestion des emails fournisseurs
                  <br />
                  <span className="text-sm">avec détection automatique des pièces jointes</span>
                </p>
              </div>
            </div>
            <CardFooter className="bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground w-full justify-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Détection automatique du fournisseur</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Extraction pièces jointes (Excel/CSV)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Historique des 3 derniers imports</span>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Wizard Steps */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold mb-8 text-center">
            Créez votre première automatisation en 2 minutes
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {wizardSteps.map((step, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">{step.number}</span>
                    <span>{step.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted/30 rounded-lg border flex items-center justify-center">
                    <p className="text-muted-foreground text-center px-4">
                      Screenshot : {step.title}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dashboard Monitoring */}
        <div className="mb-16">
          <Card className="overflow-hidden border-2 border-secondary/20 shadow-2xl">
            <div className="bg-gradient-to-r from-secondary/10 to-accent/10 p-4 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-secondary" />
                <span className="font-semibold">Dashboard Automatisations</span>
                <Badge variant="secondary">6 règles actives</Badge>
              </div>
            </div>
            <div className="aspect-video bg-muted/30 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <BarChart3 className="h-24 w-24 mx-auto text-secondary/40" />
                <p className="text-muted-foreground">
                  Capture d'écran : Dashboard de monitoring des automatisations
                  <br />
                  <span className="text-sm">avec statistiques en temps réel</span>
                </p>
              </div>
            </div>
            <CardFooter className="bg-muted/30 p-4">
              <div className="grid grid-cols-3 gap-4 text-center w-full">
                <div>
                  <div className="text-2xl font-bold text-primary">156</div>
                  <div className="text-xs text-muted-foreground">Imports réussis</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-secondary">98.7%</div>
                  <div className="text-xs text-muted-foreground">Taux de succès</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent">2.3s</div>
                  <div className="text-xs text-muted-foreground">Temps moyen</div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Video Demo */}
        <div className="text-center">
          <Card className="max-w-4xl mx-auto overflow-hidden border-2 border-primary/20">
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Button size="lg" className="gap-2 shadow-lg">
                <Play className="h-5 w-5" />
                Voir la démo complète (2min)
              </Button>
            </div>
            <CardFooter className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6">
              <p className="text-center w-full font-semibold">
                🎥 Découvrez comment importer 250 produits fournisseurs en 4 minutes chrono
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Button size="lg" className="text-lg px-12 py-6">
            <Sparkles className="mr-2 h-5 w-5" />
            Essayer gratuitement pendant 14 jours
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Sans carte bancaire • Configuration en 5 minutes
          </p>
        </div>
      </div>
    </section>
  );
};
