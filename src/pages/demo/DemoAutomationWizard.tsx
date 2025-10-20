import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileUp, Trash2, Sparkles, FileOutput, RefreshCw, Link2 } from "lucide-react";

export const DemoAutomationWizard = () => {
  const automationTypes = [
    {
      icon: FileUp,
      title: "Import automatique",
      description: "Détection et import automatique des emails fournisseurs",
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      activeCount: 3
    },
    {
      icon: Trash2,
      title: "Cleanup automatique",
      description: "Nettoyage et normalisation des données importées",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
      activeCount: 1
    },
    {
      icon: Sparkles,
      title: "Enrichissement automatique",
      description: "Enrichissement IA des fiches produits incomplètes",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      activeCount: 5
    },
    {
      icon: FileOutput,
      title: "Export automatique",
      description: "Synchronisation vers plateformes e-commerce",
      color: "text-green-600",
      bgColor: "bg-green-500/10",
      activeCount: 2
    },
    {
      icon: RefreshCw,
      title: "Synchronisation automatique",
      description: "Mise à jour bidirectionnelle des stocks et prix",
      color: "text-cyan-600",
      bgColor: "bg-cyan-500/10",
      activeCount: 4
    },
    {
      icon: Link2,
      title: "Liaison automatique",
      description: "Matching intelligent entre produits et fournisseurs",
      color: "text-pink-600",
      bgColor: "bg-pink-500/10",
      activeCount: 2
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Assistant de création d'automatisation</h2>
        <p className="text-muted-foreground">Créez une règle d'automatisation en quelques clics</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {automationTypes.map((type, index) => {
          const Icon = type.icon;
          return (
            <Card 
              key={index} 
              className="hover:shadow-lg transition-all cursor-pointer hover:border-primary/50"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-3 rounded-lg ${type.bgColor}`}>
                    <Icon className={`h-6 w-6 ${type.color}`} />
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {type.activeCount} actives
                  </Badge>
                </div>
                <CardTitle className="text-lg">{type.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {type.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Step 2: Source Configuration Preview */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Configuration de la source</CardTitle>
              <Badge>Étape 2/6</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fournisseur</label>
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="font-medium">FVS Distribution</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type de source</label>
              <div className="space-y-2">
                <div className="border rounded-lg p-3 bg-primary/5 border-primary">
                  <p className="font-medium">📧 Email (IMAP)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Surveillance de la boîte mail pour fichiers Excel/CSV
                  </p>
                </div>
                <div className="border rounded-lg p-3 opacity-60">
                  <p className="font-medium">🌐 FTP/SFTP</p>
                </div>
                <div className="border rounded-lg p-3 opacity-60">
                  <p className="font-medium">🔌 API REST</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-2">Configuration IMAP</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Serveur</label>
                  <div className="border rounded p-2 mt-1 text-sm bg-muted/30">
                    imap.gmail.com
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Port</label>
                  <div className="border rounded p-2 mt-1 text-sm bg-muted/30">
                    993
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 3: Trigger Schedule Preview */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Planification du déclencheur</CardTitle>
              <Badge>Étape 3/6</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fréquence d'exécution</label>
              <div className="border rounded-lg p-3 bg-primary/5 border-primary">
                <p className="font-medium">📅 Quotidien</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Heure d'exécution</label>
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="font-mono text-lg">06:00</p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-2">Aperçu de la planification</p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm">
                  ⏰ <strong>Tous les jours à 06:00</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prochaine exécution : Demain à 06:00
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step 4: Actions Preview */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Actions à effectuer</CardTitle>
              <Badge>Étape 4/6</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border rounded-lg p-3 bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-green-600 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <p className="font-medium">Enrichir automatiquement les fiches produits</p>
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-green-600 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <p className="font-medium">Lier automatiquement aux produits existants</p>
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-green-600 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <p className="font-medium">Envoyer des alertes par email</p>
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-green-600 flex items-center justify-center text-white text-xs">
                  ✓
                </div>
                <p className="font-medium">Export automatique vers Shopify</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
