import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, RefreshCw, MessageSquare, Activity } from "lucide-react";
import { useProductChatRAG } from "@/hooks/useProductChatRAG";
import { useToast } from "@/hooks/use-toast";

const GeminiRAGDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { storeInfo, syncStore, isLoading } = useProductChatRAG();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncStore();
      toast({
        title: "✅ Synchronisation réussie",
        description: `${storeInfo?.productCount || 0} produits indexés dans Gemini`,
      });
    } catch (error) {
      toast({
        title: "❌ Erreur de synchronisation",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            RAG Gemini - Intelligence Produits
          </h1>
          <p className="text-muted-foreground mt-1">
            Posez des questions en langage naturel sur votre catalogue complet
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits Indexés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{storeInfo?.productCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dans le store Gemini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dernière Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {storeInfo?.lastSyncAt ? new Date(storeInfo.lastSyncAt).toLocaleString('fr-FR') : "Jamais"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mise à jour automatique
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={storeInfo?.productCount && storeInfo.productCount > 0 ? "default" : "secondary"} className="text-sm">
              {storeInfo?.productCount && storeInfo.productCount > 0 ? "✅ Actif" : "⏸️ Inactif"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {isLoading ? "Chargement..." : "Prêt"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actions Rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/unified-products?tab=chat')}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ouvrir Chat
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Actions principales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Synchronisation du Store
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Synchronisez vos produits avec Gemini pour permettre au chat RAG d'accéder aux données les plus récentes.
            La synchronisation indexe jusqu'à 100 produits à la fois.
          </p>
          <div className="flex gap-4">
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/unified-products?tab=chat')}
            >
              💬 Accéder au Chat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Configuration / Historique */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">⚙️ Configuration</TabsTrigger>
          <TabsTrigger value="usage">📊 Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration du RAG</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Modèle utilisé</h4>
                <p className="text-sm text-muted-foreground">
                  <code className="bg-muted px-2 py-1 rounded">google/gemini-2.5-flash</code>
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Fonctionnalités</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Recherche sémantique dans le catalogue</li>
                  <li>Analyse de rentabilité produits</li>
                  <li>Recommandations personnalisées</li>
                  <li>Comparaisons multi-critères</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques d'Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Les statistiques d'usage détaillées seront disponibles prochainement.
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  💡 <strong>Astuce :</strong> Le RAG Gemini utilise le modèle Gemini 2.5 Flash via Lovable AI 
                  pour des performances optimales et des coûts maîtrisés.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GeminiRAGDashboard;
