import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ExternalLink, Star, RefreshCw, Image, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { CompetitiveHistoryTable } from "@/components/CompetitiveHistoryTable";
import { Badge } from "@/components/ui/badge";
import { getRepairabilityData, getEnvironmentalData, getHSCodeData } from "@/lib/analysisDataExtractors";
import { ProductDetailModal } from "@/components/ProductDetailModal";

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  mapped_category_name: string | null;
  created_at: string;
  is_favorite: boolean;
  image_urls: any;
}

export default function History() {
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ProductAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleOpenDetail = (analysis: ProductAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const toggleFavorite = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("product_analyses")
        .update({ is_favorite: !currentState })
        .eq("id", id);

      if (error) throw error;
      loadAnalyses();
      toast({
        title: !currentState ? "Ajouté aux favoris" : "Retiré des favoris",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      loadAnalyses();
    };
    checkAuth();
  }, [navigate]);

  const loadAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from("product_analyses")
        .select("id, product_url, analysis_result, mapped_category_name, created_at, is_favorite, image_urls")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      const { error } = await supabase
        .from("product_analyses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null);
      }
      
      loadAnalyses();
      toast({
        title: "Supprimé",
        description: "L'analyse a été supprimée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getProductName = (analysis: any) => {
    if (typeof analysis === "string") return "Produit";
    return analysis?.analysis_result?.product_name ||
           analysis?.analysis_result?.name ||
           analysis?.product_name || 
           analysis?.name || 
           "Produit";
  };

  const getProductPrice = (analysis: any) => {
    if (typeof analysis === "string") return "-";
    return analysis?.pricing?.estimated_price || 
           analysis?.price || 
           analysis?.product_price || 
           "-";
  };

  const getProductScore = (analysis: any) => {
    if (typeof analysis === "string") return "-";
    const score = analysis?.quality_score || 
                  analysis?.score || 
                  analysis?.global_report?.overall_score;
    return score ? `${score}${typeof score === 'number' && score <= 100 ? '/100' : ''}` : "-";
  };

  const getProductDescription = (analysis: any) => {
    if (typeof analysis === "string") return "-";
    const desc = analysis?.description || analysis?.product_description || "";
    // Handle case where description is an object
    if (typeof desc === "object" && desc !== null) {
      const descText = desc.suggested_description || desc.current_quality || JSON.stringify(desc);
      return descText.length > 50 ? descText.substring(0, 50) + "..." : descText || "-";
    }
    return desc.length > 50 ? desc.substring(0, 50) + "..." : desc || "-";
  };

  const getProductTags = (analysis: any) => {
    if (typeof analysis === "string") return [];
    const tags = analysis?.tags || analysis?.product_tags || [];
    // Ensure we return an array
    if (Array.isArray(tags)) return tags;
    return [];
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(analyses.map(a => a.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const regenerateAmazonData = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins un produit",
        variant: "destructive",
      });
      return;
    }

    setIsRegenerating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of Array.from(selectedIds)) {
      try {
        const { data, error } = await supabase.functions.invoke('amazon-product-enrichment', {
          body: { analysis_id: id }
        });

        if (error) throw error;
        successCount++;
      } catch (error: any) {
        console.error(`Erreur pour le produit ${id}:`, error);
        errorCount++;
      }
    }

    setIsRegenerating(false);
    loadAnalyses();
    
    toast({
      title: "Régénération terminée",
      description: `${successCount} succès, ${errorCount} erreurs`,
    });
  };

  const regenerateImages = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins un produit",
        variant: "destructive",
      });
      return;
    }

    setIsRegenerating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of Array.from(selectedIds)) {
      try {
        const analysis = analyses.find(a => a.id === id);
        if (!analysis) continue;

        const productName = getProductName(analysis.analysis_result);
        
        const { data, error } = await supabase.functions.invoke('search-product-images', {
          body: { 
            productName,
            maxResults: 10
          }
        });

        if (error) throw error;

        if (data?.images && data.images.length > 0) {
          await supabase
            .from('product_analyses')
            .update({ image_urls: data.images })
            .eq('id', id);
          successCount++;
        }
      } catch (error: any) {
        console.error(`Erreur pour le produit ${id}:`, error);
        errorCount++;
      }
    }

    setIsRegenerating(false);
    loadAnalyses();
    
    toast({
      title: "Régénération des images terminée",
      description: `${successCount} succès, ${errorCount} erreurs`,
    });
  };

  const regenerateAllData = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins un produit",
        variant: "destructive",
      });
      return;
    }

    setIsRegenerating(true);
    await Promise.all([regenerateAmazonData(), regenerateImages()]);
    setIsRegenerating(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Historique des Analyses & Concurrence</h1>
        
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tableau Concurrentiel</CardTitle>
                <CardDescription>
                  {analyses.length} produit(s) analysé(s) - {selectedIds.size} sélectionné(s)
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateAmazonData}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Package className="h-4 w-4 mr-2" />
                    )}
                    Amazon
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateImages}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Image className="h-4 w-4 mr-2" />
                    )}
                    Images
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateAllData}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Tout régénérer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAll}
                  >
                    Désélectionner
                  </Button>
                </div>
              )}
              {selectedIds.size === 0 && analyses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                >
                  Tout sélectionner
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {analyses.length > 0 ? (
              <CompetitiveHistoryTable 
                analyses={analyses}
                onDelete={deleteAnalysis}
                onViewDetail={setSelectedAnalysis}
                onOpenDetail={handleOpenDetail}
                selectedIds={selectedIds}
                onToggleSelection={toggleSelection}
              />
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune analyse trouvée</p>
            )}
          </CardContent>
        </Card>

        {selectedAnalysis && (
          <Card className="glass-card mt-4">
            <CardHeader>
              <CardTitle>Détails de l'Analyse</CardTitle>
              <CardDescription>
                Informations complètes sur le produit analysé
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DetailedAnalysisView analysis={selectedAnalysis} />
            </CardContent>
          </Card>
        )}
      </main>

      <ProductDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        analysis={selectedAnalysis}
        allAnalyses={analyses}
        onDelete={deleteAnalysis}
        onToggleFavorite={toggleFavorite}
        onReload={loadAnalyses}
      />
    </div>
  );
}
