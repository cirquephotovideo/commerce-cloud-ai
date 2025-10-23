import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Star, Download, BarChart3, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetitiveHistoryTable } from "@/components/CompetitiveHistoryTable";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
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
  const [selectedAnalyses, setSelectedAnalyses] = useState<Set<string>>(new Set());
  
  // Filtres
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'price'>('date');
  
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

  const handleBulkFavorite = async () => {
    try {
      const ids = Array.from(selectedAnalyses);
      const { error } = await supabase
        .from("product_analyses")
        .update({ is_favorite: true })
        .in("id", ids);

      if (error) throw error;
      
      setSelectedAnalyses(new Set());
      loadAnalyses();
      toast({
        title: "✓ Succès",
        description: `${ids.length} produit(s) marqué(s) comme favoris`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedAnalyses.size} analyse(s) ?`)) return;
    
    try {
      const ids = Array.from(selectedAnalyses);
      const { error } = await supabase
        .from("product_analyses")
        .delete()
        .in("id", ids);

      if (error) throw error;
      
      setSelectedAnalyses(new Set());
      loadAnalyses();
      toast({
        title: "✓ Supprimées",
        description: `${ids.length} analyse(s) supprimée(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkEnrichOdoo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "❌ Erreur",
          description: "Non authentifié",
          variant: "destructive",
        });
        return;
      }

      const ids = Array.from(selectedAnalyses);
      
      // Récupérer supplier_product_id DIRECT depuis product_analyses
      const { data: analysesData, error: analysesError } = await supabase
        .from('product_analyses')
        .select('id, supplier_product_id')
        .in('id', ids);

      if (analysesError) {
        console.error('[History] Analyses fetch error:', analysesError);
        toast({
          title: "❌ Erreur",
          description: analysesError.message,
          variant: "destructive",
        });
        return;
      }

      // Filtrer celles qui ont un supplier_product_id
      const validAnalyses = (analysesData || []).filter(a => a.supplier_product_id);

      if (validAnalyses.length === 0) {
        toast({
          title: "⚠️ Avertissement",
          description: "Aucun produit fournisseur lié aux analyses sélectionnées",
          variant: "destructive",
        });
        return;
      }

      // Créer les tâches d'enrichissement
      const enrichmentTasks = validAnalyses.map(analysis => ({
        user_id: user.id,
        supplier_product_id: analysis.supplier_product_id,
        analysis_id: analysis.id,
        enrichment_type: ['odoo_attributes'],
        priority: 'high',
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('enrichment_queue')
        .insert(enrichmentTasks);

      if (insertError) {
        console.error('[History] Queue insert error:', insertError);
        toast({
          title: "❌ Erreur",
          description: insertError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✨ Enrichissement lancé",
        description: `${validAnalyses.length} produit(s) ajouté(s) à la file d'enrichissement Odoo`,
      });

      // Déclencher le traitement
      const { error: processError } = await supabase.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: validAnalyses.length } }
      );

      if (processError) {
        console.error('[History] Processing error:', processError);
        toast({
          title: "⏳ En file d'attente",
          description: "Les enrichissements seront traités automatiquement",
        });
      } else {
        toast({
          title: "🚀 Traitement démarré !",
          description: `Enrichissement des attributs Odoo en cours...`,
        });
      }

      // Réinitialiser la sélection et recharger
      setSelectedAnalyses(new Set());
      setTimeout(() => loadAnalyses(), 3000);

    } catch (error: any) {
      console.error("[History] Odoo enrichment error:", error);
      toast({
        title: "❌ Erreur",
        description: "Erreur lors de l'enrichissement des attributs",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredAnalyses.map(a => ({
      'Nom': getProductName(a.analysis_result),
      'Prix': getProductPrice(a.analysis_result),
      'Score': getProductScore(a.analysis_result),
      'Catégorie': a.mapped_category_name || 'N/A',
      'Date': new Date(a.created_at).toLocaleDateString('fr-FR'),
      'Favori': a.is_favorite ? 'Oui' : 'Non',
      'URL': a.product_url
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_analyses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "✓ Exporté",
      description: "Fichier CSV téléchargé",
    });
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
    if (typeof analysis === "string") return 0;
    return analysis?.quality_score || 
           analysis?.score || 
           analysis?.global_report?.overall_score || 
           0;
  };

  // Logique de filtrage et tri
  const filteredAnalyses = analyses
    .filter(a => !filterFavorites || a.is_favorite)
    .filter(a => filterCategory === 'all' || a.mapped_category_name === filterCategory)
    .filter(a => {
      if (filterScore === 'all') return true;
      const score = getProductScore(a.analysis_result);
      if (filterScore === 'high') return score > 70;
      if (filterScore === 'medium') return score >= 40 && score <= 70;
      if (filterScore === 'low') return score < 40;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'score') return getProductScore(b.analysis_result) - getProductScore(a.analysis_result);
      if (sortBy === 'price') {
        const priceA = parseFloat(getProductPrice(a.analysis_result)) || 0;
        const priceB = parseFloat(getProductPrice(b.analysis_result)) || 0;
        return priceB - priceA;
      }
      return 0;
    });

  const uniqueCategories = Array.from(new Set(analyses.map(a => a.mapped_category_name).filter(Boolean)));
  const highScoreCount = analyses.filter(a => getProductScore(a.analysis_result) > 70).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Historique des Analyses</h1>
          <Button 
            variant="outline" 
            onClick={() => navigate('/import-export-dashboard')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard Import/Export
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{analyses.length}</div>
              <p className="text-sm text-muted-foreground">Analyses totales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-yellow-500">
                {analyses.filter(a => a.is_favorite).length}
              </div>
              <p className="text-sm text-muted-foreground">Favoris</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-500">
                {highScoreCount}
              </div>
              <p className="text-sm text-muted-foreground">Score &gt; 70</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-500">
                {uniqueCategories.length}
              </div>
              <p className="text-sm text-muted-foreground">Catégories</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtres Avancés */}
        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <span className="text-sm text-muted-foreground">Filtres:</span>
          
          <Button
            variant={filterFavorites ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterFavorites(!filterFavorites)}
          >
            <Star className="w-4 h-4 mr-2" />
            Favoris uniquement
          </Button>

          <Select value={filterScore} onValueChange={(v) => setFilterScore(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous scores</SelectItem>
              <SelectItem value="high">🟢 &gt; 70</SelectItem>
              <SelectItem value="medium">🟡 40-70</SelectItem>
              <SelectItem value="low">🔴 &lt; 40</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {uniqueCategories.map(cat => (
                <SelectItem key={cat} value={cat || 'none'}>{cat || 'Sans catégorie'}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">📅 Date</SelectItem>
              <SelectItem value="score">⭐ Score</SelectItem>
              <SelectItem value="price">💰 Prix</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setFilterFavorites(false);
              setFilterCategory('all');
              setFilterScore('all');
              setSortBy('date');
            }}
          >
            Réinitialiser
          </Button>
        </div>

        {/* Actions en Masse */}
        <div className="flex gap-2 mb-4 items-center">
          <Checkbox
            checked={selectedAnalyses.size === filteredAnalyses.length && filteredAnalyses.length > 0}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedAnalyses(new Set(filteredAnalyses.map(a => a.id)));
              } else {
                setSelectedAnalyses(new Set());
              }
            }}
          />
          <span className="text-sm text-muted-foreground">
            {selectedAnalyses.size} sélectionné(s)
          </span>

          {selectedAnalyses.size > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkFavorite}
              >
                <Star className="w-4 h-4 mr-2" />
                Marquer favoris
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportCSV}
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBulkEnrichOdoo}
                className="bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30"
              >
                <Database className="w-4 h-4 mr-2" />
                Enrichir Attributs Odoo
              </Button>
              
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </>
          )}
        </div>
        
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Tableau Concurrentiel</CardTitle>
            <CardDescription>
              {filteredAnalyses.length} produit(s) affiché(s) sur {analyses.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAnalyses.length > 0 ? (
              <CompetitiveHistoryTable 
                analyses={filteredAnalyses}
                onDelete={deleteAnalysis}
                onViewDetail={setSelectedAnalysis}
                onOpenDetail={handleOpenDetail}
                selectedAnalyses={selectedAnalyses}
                onSelectAnalysis={(id: string, checked: boolean) => {
                  const newSelection = new Set(selectedAnalyses);
                  if (checked) {
                    newSelection.add(id);
                  } else {
                    newSelection.delete(id);
                  }
                  setSelectedAnalyses(newSelection);
                }}
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

        <ProductDetailModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          product={selectedAnalysis}
        />
      </main>
  );
}