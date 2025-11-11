import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link2, TrendingUp, CheckCircle, AlertCircle, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductLink {
  id: string;
  analysis_id: string;
  supplier_product_id: string;
  link_type: string;
  confidence_score: number;
  created_at: string;
  product_analyses: {
    ean: string;
    analysis_result: any;
  };
  supplier_products: {
    product_name: string;
    ean: string;
    purchase_price: number;
  };
}

interface LinkStats {
  total_links: number;
  auto_links: number;
  manual_links: number;
  suggested_links: number;
  avg_confidence: number;
  links_by_day: Array<{ date: string; count: number }>;
}

export function ProductLinksDashboard() {
  const [selectedLink, setSelectedLink] = useState<ProductLink | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch all product links with details
  const { data: links, isLoading, refetch } = useQuery({
    queryKey: ["product-links-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("product_links")
        .select(`
          *,
          product_analyses(ean, analysis_result),
          supplier_products(product_name, ean, purchase_price)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProductLink[];
    },
    refetchInterval: 30000,
  });

  // Calculate statistics
  const stats: LinkStats = {
    total_links: links?.length || 0,
    auto_links: links?.filter(l => l.link_type === "auto").length || 0,
    manual_links: links?.filter(l => l.link_type === "manual").length || 0,
    suggested_links: links?.filter(l => l.link_type === "suggested").length || 0,
    avg_confidence: links?.length
      ? Math.round(links.reduce((sum, l) => sum + l.confidence_score, 0) / links.length)
      : 0,
    links_by_day: [],
  };

  // Group links by day for trend chart
  if (links && links.length > 0) {
    const linksByDate = links.reduce((acc, link) => {
      const date = new Date(link.created_at).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    stats.links_by_day = Object.entries(linksByDate)
      .map(([date, count]) => ({ date, count }))
      .slice(0, 7)
      .reverse();
  }

  const handleDeleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from("product_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      toast.success("Lien supprimé");
      refetch();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression: " + error.message);
    }
  };

  const getLinkTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      auto: { variant: "default", label: "🤖 Auto" },
      manual: { variant: "secondary", label: "👤 Manuel" },
      suggested: { variant: "outline", label: "💡 Suggéré" },
    };
    const config = variants[type] || variants.auto;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 95) return <Badge className="bg-green-500">Excellent ({score}%)</Badge>;
    if (score >= 85) return <Badge className="bg-blue-500">Bon ({score}%)</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-500">Moyen ({score}%)</Badge>;
    return <Badge variant="destructive">Faible ({score}%)</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📊 Dashboard des Liens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Dashboard des Liens Produits
          </CardTitle>
          <CardDescription>
            Vue d'ensemble complète de vos liens entre produits analysés et fournisseurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">📊 Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="all-links">🔗 Tous les liens ({stats.total_links})</TabsTrigger>
              <TabsTrigger value="trends">📈 Tendances</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Liens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.total_links}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tous types confondus
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Liens Automatiques
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.auto_links}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.total_links > 0 ? Math.round((stats.auto_links / stats.total_links) * 100) : 0}% du total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Confiance Moyenne
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{stats.avg_confidence}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score global de qualité
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Suggérés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-yellow-600">{stats.suggested_links}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      En attente de validation
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Derniers Liens Créés</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {links?.slice(0, 10).map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getLinkTypeBadge(link.link_type)}
                              {getConfidenceBadge(link.confidence_score)}
                            </div>
                            <p className="font-medium truncate">
                              {link.product_analyses?.analysis_result?.name || "Produit sans nom"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              → {link.supplier_products?.product_name || "Fournisseur inconnu"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(link.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedLink(link);
                                setDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* All Links Tab */}
            <TabsContent value="all-links" className="space-y-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {links?.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getLinkTypeBadge(link.link_type)}
                          {getConfidenceBadge(link.confidence_score)}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Produit Analysé</p>
                            <p className="font-medium">{link.product_analyses?.analysis_result?.name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">EAN: {link.product_analyses?.ean || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Produit Fournisseur</p>
                            <p className="font-medium">{link.supplier_products?.product_name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">
                              Prix: {link.supplier_products?.purchase_price?.toFixed(2)}€
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLink(link);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Évolution des liens (7 derniers jours)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-end gap-2">
                    {stats.links_by_day.map((day) => (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-primary rounded-t-lg transition-all hover:bg-primary/80"
                          style={{ height: `${(day.count / Math.max(...stats.links_by_day.map(d => d.count))) * 100}%`, minHeight: "20px" }}
                        />
                        <div className="text-xs text-center">
                          <p className="font-bold">{day.count}</p>
                          <p className="text-muted-foreground">{day.date.split('/')[0]}/{day.date.split('/')[1]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Taux de Correspondance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {stats.total_links > 0 ? Math.round((stats.auto_links / stats.total_links) * 100) : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Pourcentage de liens créés automatiquement
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Qualité Moyenne
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {stats.avg_confidence}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Score de confiance moyen des liens
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Link Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du Lien</DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {getLinkTypeBadge(selectedLink.link_type)}
                {getConfidenceBadge(selectedLink.confidence_score)}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-primary">Produit Analysé</h3>
                  <div className="space-y-1">
                    <p><strong>Nom:</strong> {selectedLink.product_analyses?.analysis_result?.name || "N/A"}</p>
                    <p><strong>Marque:</strong> {selectedLink.product_analyses?.analysis_result?.brand || "N/A"}</p>
                    <p><strong>EAN:</strong> {selectedLink.product_analyses?.ean || "N/A"}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-semibold text-primary">Produit Fournisseur</h3>
                  <div className="space-y-1">
                    <p><strong>Nom:</strong> {selectedLink.supplier_products?.product_name || "N/A"}</p>
                    <p><strong>EAN:</strong> {selectedLink.supplier_products?.ean || "N/A"}</p>
                    <p><strong>Prix d'achat:</strong> {selectedLink.supplier_products?.purchase_price?.toFixed(2)}€</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Créé le {new Date(selectedLink.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
