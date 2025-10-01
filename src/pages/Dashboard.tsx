import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Trash2, ExternalLink, Upload, Trash, Search, Barcode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JsonViewer } from "@/components/JsonViewer";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { ProductExportMenu } from "@/components/ProductExportMenu";
import { ProductAnalysisDialog } from "@/components/ProductAnalysisDialog";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAIProvider } from "@/hooks/useAIProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  is_favorite: boolean;
  created_at: string;
}

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<ProductAnalysis[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"url" | "ean">("url");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = useFeaturePermissions();
  const { provider, updateProvider } = useAIProvider();

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

  useEffect(() => {
    // Filtrer les analyses en fonction de la recherche
    if (!searchQuery.trim()) {
      setFilteredAnalyses(analyses);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = analyses.filter(analysis => {
      if (searchType === "url") {
        return analysis.product_url.toLowerCase().includes(query);
      } else {
        // Recherche par EAN dans analysis_result
        const ean = analysis.analysis_result?.ean || analysis.analysis_result?.barcode || "";
        return ean.toLowerCase().includes(query);
      }
    });
    setFilteredAnalyses(filtered);
  }, [searchQuery, searchType, analyses]);

  const loadAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from("product_analyses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
      setFilteredAnalyses(data || []);
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

  const toggleFavorite = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("product_analyses")
        .update({ is_favorite: !currentState })
        .eq("id", id);

      if (error) throw error;
      loadAnalyses();
      toast({
        title: "Mis à jour",
        description: !currentState ? "Ajouté aux favoris" : "Retiré des favoris",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      const { error } = await supabase
        .from("product_analyses")
        .delete()
        .eq("id", id);

      if (error) throw error;
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAnalyses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAnalyses.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const exportToOdoo = async () => {
    if (selectedIds.size === 0) return;
    
    setIsExporting(true);
    try {
      const selectedAnalyses = analyses.filter(a => selectedIds.has(a.id));
      
      const { data, error } = await supabase.functions.invoke('export-to-odoo', {
        body: { 
          analyses: selectedAnalyses.map(a => ({
            id: a.id,
            product_url: a.product_url,
            analysis_result: a.analysis_result
          }))
        }
      });

      if (error) throw error;

      toast({
        title: "Export réussi",
        description: `${selectedIds.size} produit(s) exporté(s) vers Odoo`,
      });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({
        title: "Erreur d'export",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("product_analyses")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: "Supprimé",
        description: `${selectedIds.size} analyse(s) supprimée(s)`,
      });
      setSelectedIds(new Set());
      loadAnalyses();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
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
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <SubscriptionStatus />
          </div>
          <div className="lg:col-span-2 space-y-4">
            {/* AI Provider Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Provider IA</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={provider} onValueChange={updateProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">🚀 Lovable AI</SelectItem>
                    <SelectItem value="ollama">💻 Ollama Cloud (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiques</CardTitle>
                <CardDescription>Aperçu de votre activité</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{analyses.length}</p>
                    <p className="text-sm text-muted-foreground">Analyses totales</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analyses.filter(a => a.is_favorite).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Favoris</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Bar */}
        {hasPermission('ean_search') && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Select value={searchType} onValueChange={(v) => setSearchType(v as "url" | "ean")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Par URL
                      </div>
                    </SelectItem>
                    <SelectItem value="ean">
                      <div className="flex items-center gap-2">
                        <Barcode className="w-4 h-4" />
                        Par EAN/Barcode
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={searchType === "url" ? "Rechercher par URL..." : "Rechercher par code EAN ou barcode..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Mes Analyses de Produits {searchQuery && `(${filteredAnalyses.length})`}
          </h1>
          {analyses.length > 0 && (
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 mr-4">
                <Checkbox
                  id="select-all"
                  checked={selectedIds.size === filteredAnalyses.length && filteredAnalyses.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm cursor-pointer">
                  Tout sélectionner ({selectedIds.size}/{filteredAnalyses.length})
                </label>
              </div>
              {selectedIds.size > 0 && (
                <>
                  <Button
                    onClick={exportToOdoo}
                    disabled={isExporting}
                    variant="default"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Export...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Exporter vers Odoo ({selectedIds.size})
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={deleteSelected}
                    disabled={isDeleting}
                    variant="destructive"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash className="mr-2 h-4 w-4" />
                        Supprimer ({selectedIds.size})
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        
        {filteredAnalyses.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                {searchQuery ? "Aucun résultat trouvé" : "Aucune analyse sauvegardée pour le moment."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredAnalyses.map((analysis) => {
              const productName = analysis.analysis_result?.name || "Produit sans nom";
              const productPrice = analysis.analysis_result?.price || "N/A";
              
              return (
                <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox
                          checked={selectedIds.has(analysis.id)}
                          onCheckedChange={() => toggleSelect(analysis.id)}
                        />
                        <CardTitle className="text-lg line-clamp-2">{productName}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(analysis.id, analysis.is_favorite)}
                      >
                        <Star className={`h-5 w-5 ${analysis.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      {hasPermission('single_export') && (
                        <ProductExportMenu analysisId={analysis.id} productName={productName} />
                      )}
                      {(hasPermission('technical_analysis') || hasPermission('risk_analysis')) && (
                        <ProductAnalysisDialog productUrl={analysis.product_url} productName={productName} />
                      )}
                      <JsonViewer data={analysis.analysis_result} />
                      <Button variant="outline" size="sm" onClick={() => deleteAnalysis(analysis.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {analyses.map((analysis) => (
              <Card key={analysis.id} className="glass-card hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(analysis.id)}
                      onCheckedChange={() => toggleSelect(analysis.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {analysis.product_url}
                        <a
                          href={analysis.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </CardTitle>
                      <CardDescription>
                        {new Date(analysis.created_at).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(analysis.id, analysis.is_favorite)}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            analysis.is_favorite ? "fill-yellow-400 text-yellow-400" : ""
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAnalysis(analysis.id)}
                      >
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <JsonViewer data={analysis.analysis_result} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
