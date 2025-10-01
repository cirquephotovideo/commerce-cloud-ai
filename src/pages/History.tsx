import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ExternalLink, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JsonViewer } from "@/components/JsonViewer";

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  mapped_category_name: string | null;
  created_at: string;
  is_favorite: boolean;
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
        .select("id, product_url, analysis_result, mapped_category_name, created_at, is_favorite")
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
    return analysis?.price || analysis?.product_price || "-";
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                          <span className="truncate max-w-[200px]">
                            {getProductName(analysis.analysis_result)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{analysis.mapped_category_name || "-"}</TableCell>
                      <TableCell>{getProductPrice(analysis.analysis_result)}</TableCell>
                      <TableCell>
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
          </CardContent>
        </Card>

        {selectedAnalysis && (
          <Card className="glass-card mt-4">
            <CardHeader>
              <CardTitle>Détails de l'Analyse</CardTitle>
              <CardDescription>
                {getProductName(selectedAnalysis.analysis_result)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer data={selectedAnalysis.analysis_result} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
