import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ExternalLink, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { Badge } from "@/components/ui/badge";
import { getRepairabilityData, getEnvironmentalData, getHSCodeData } from "@/lib/analysisDataExtractors";

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
  const navigate = useNavigate();
  const { toast } = useToast();

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
    return analysis?.product_name || analysis?.name || "Produit";
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
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Historique des Analyses
        </h1>
        
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Analyses de Produits</CardTitle>
            <CardDescription>
              {analyses.length} analyse(s) effectuée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Produit</TableHead>
                    <TableHead className="w-[150px]">Catégorie</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Prix</TableHead>
                    <TableHead className="w-[80px]">Score</TableHead>
                    <TableHead className="w-[80px]">🔧 Répara.</TableHead>
                    <TableHead className="w-[80px]">🌱 Éco</TableHead>
                    <TableHead className="w-[100px]">📋 HS Code</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        Aucune analyse trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    analyses.map((analysis) => (
                      <TableRow 
                        key={analysis.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedAnalysis(analysis)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {analysis.is_favorite && <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                            <span className="truncate max-w-[180px]">
                              {getProductName(analysis.analysis_result)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {analysis.mapped_category_name || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getProductDescription(analysis.analysis_result)}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {getProductPrice(analysis.analysis_result)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {getProductScore(analysis.analysis_result)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const repairability = getRepairabilityData(analysis);
                            return repairability?.score ? (
                              <Badge variant={repairability.score >= 7 ? "default" : repairability.score >= 5 ? "secondary" : "destructive"} className="text-xs">
                                {repairability.score}/10
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const environmental = getEnvironmentalData(analysis);
                            return environmental?.ecoScore ? (
                              <Badge variant="default" className="text-xs bg-green-600">
                                {environmental.ecoScore}/10
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const hsCode = getHSCodeData(analysis);
                            return hsCode?.code ? (
                              <Badge variant="outline" className="text-xs font-mono">
                                {hsCode.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(analysis.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(analysis.product_url, "_blank");
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAnalysis(analysis.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
    </div>
  );
}
