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
import { CompetitiveHistoryTable } from "@/components/CompetitiveHistoryTable";
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
        <h1 className="text-4xl font-bold mb-8">Historique des Analyses & Concurrence</h1>
        
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Tableau Concurrentiel</CardTitle>
            <CardDescription>
              {analyses.length} produit(s) analysé(s) avec surveillance marché
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyses.length > 0 ? (
              <CompetitiveHistoryTable 
                analyses={analyses}
                onDelete={deleteAnalysis}
                onViewDetail={setSelectedAnalysis}
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
    </div>
  );
}
