import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Trash2, Upload, Trash, Search, Barcode, Package, Video, FileCheck, Sparkles, ChevronDown, X } from "lucide-react";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { useToast } from "@/hooks/use-toast";
import { JsonViewer } from "@/components/JsonViewer";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { ProductExportMenu } from "@/components/ProductExportMenu";
import { ProductAnalysisDialog } from "@/components/ProductAnalysisDialog";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import AIProviderManagement from "@/components/AIProviderManagement";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { ProductSummaryDialog } from "@/components/ProductSummaryDialog";
import { TaxonomyBadges } from "@/components/TaxonomyBadges";
import { UserAlertsWidget } from "@/components/UserAlertsWidget";
import { EnrichmentProgressMonitor } from "@/components/EnrichmentProgressMonitor";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  image_urls?: string[];
  is_favorite: boolean;
  created_at: string;
  mapped_category_name?: string | null;
  tags?: any;
  description_long?: string;
  competitive_pros?: any;
  competitive_cons?: any;
  use_cases?: any;
  amazon_enrichment_status?: string | null;
  amazon_last_attempt?: string | null;
  enrichment_status?: {
    amazon?: string;
    heygen?: string;
    rsgp?: string;
  };
}

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<ProductAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<ProductAnalysis[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"url" | "ean" | "name">("name");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ProductAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = useFeaturePermissions();

  const handleOpenDetail = (analysis: ProductAnalysis) => {
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const handleShowDetails = (analysis: ProductAnalysis) => {
    setSelectedAnalysis(analysis);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReEnrich = async (analysisId: string, provider: 'lovable-ai' | 'ollama' | 'openai') => {
    setEnrichingIds(prev => new Set(prev).add(analysisId));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Authentification requise",
          description: "Votre session a expiré.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('re-enrich-product', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { 
          productId: analysisId,
          enrichmentTypes: ['ai_analysis', 'amazon'],
          provider: provider
        }
      });

      if (error) throw error;

      toast({
        title: "Re-enrichissement lancé",
        description: `L'enrichissement avec ${provider} a été lancé avec succès.`,
      });
      
      // Reload after a delay
      setTimeout(() => {
        loadAnalyses();
        if (selectedAnalysis?.id === analysisId) {
          // Refresh the selected analysis
          const refreshed = analyses.find(a => a.id === analysisId);
          if (refreshed) setSelectedAnalysis(refreshed);
        }
      }, 3000);
    } catch (error: any) {
      console.error('Re-enrichment error:', error);
      
      let description = error.message || "Une erreur est survenue";
      
      // Provide specific error messages based on error type
      if (error.message?.includes('401') || error.message?.includes('Authentication failed')) {
        description = "Votre session a expiré. Veuillez vous reconnecter.";
        setTimeout(() => navigate("/auth"), 2000);
      } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        description = "Limite de taux dépassée. Réessayez dans quelques instants.";
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        description = "Crédits insuffisants. Rechargez votre compte.";
      } else if (error.message?.includes('Product not found')) {
        description = "Produit introuvable. Veuillez réessayer.";
      }
      
      toast({
        title: "Erreur lors du re-enrichissement",
        description,
        variant: "destructive",
      });
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(analysisId);
        return next;
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

  // Auto-categorize new analyses
  useEffect(() => {
    const categorizNewAnalyses = async () => {
      for (const analysis of analyses) {
        // Check if already categorized
        const { data: existing } = await supabase
          .from('product_taxonomy_mappings')
          .select('id')
          .eq('analysis_id', analysis.id)
          .maybeSingle();
        
        if (!existing) {
          // Trigger categorization
          try {
            await supabase.functions.invoke('ai-taxonomy-categorizer', {
              body: { analysis_id: analysis.id }
            });
          } catch (error) {
            console.error('Auto-categorization error:', error);
          }
        }
      }
    };

    if (analyses.length > 0) {
      categorizNewAnalyses();
    }
  }, [analyses]);

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
      } else if (searchType === "ean") {
        // Recherche par EAN dans analysis_result
        const ean = analysis.analysis_result?.ean || analysis.analysis_result?.barcode || "";
        return ean.toLowerCase().includes(query);
      } else {
        // Recherche par nom de produit
        const name = analysis.analysis_result?.name || "";
        return name.toLowerCase().includes(query);
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
      
      // Convert image_urls from Json to string[]
      const processedData = (data || []).map(item => ({
        ...item,
        image_urls: Array.isArray(item.image_urls) ? item.image_urls : []
      })) as ProductAnalysis[];
      
      setAnalyses(processedData);
      setFilteredAnalyses(processedData);
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
      // Get current session explicitly
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        toast({
          title: "Authentification requise",
          description: "Votre session a expiré, veuillez vous reconnecter.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('export-to-odoo', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: { 
          analysisIds: Array.from(selectedIds)
        }
      });

      if (error) {
        // Handle 401 specifically
        if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) {
          toast({
            title: "Session expirée",
            description: "Votre session a expiré, veuillez vous reconnecter.",
            variant: "destructive",
          });
          navigate("/auth");
          return;
        }
        throw error;
      }

      // Show detailed success message with created/updated counts
      const { success_count, error_count, created_count = 0, updated_count = 0 } = data || {};
      
      if (success_count > 0) {
        let message = `${success_count} produit(s) exporté(s) vers Odoo`;
        if (created_count > 0 || updated_count > 0) {
          message += ` (${created_count} créé(s), ${updated_count} mis à jour)`;
        }
        toast({
          title: "Export réussi",
          description: message,
        });
      }
      
      if (error_count > 0) {
        toast({
          title: "Export partiel",
          description: `${error_count} erreur(s) lors de l'export`,
          variant: "destructive",
        });
      }
      
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

  const handleQuickEnrich = async (analysisId: string, type: 'amazon' | 'heygen' | 'rsgp' | 'all') => {
    setEnrichingIds(prev => new Set(prev).add(analysisId));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Authentification requise",
          description: "Votre session a expiré.",
          variant: "destructive",
        });
        return;
      }

      const enrichments = type === 'all' ? ['amazon', 'heygen', 'rsgp'] : [type];
      
      for (const enrichType of enrichments) {
        if (enrichType === 'amazon') {
          await supabase.functions.invoke('amazon-product-enrichment', {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
            body: { analysis_id: analysisId, force_regenerate: true }
          });
        } else if (enrichType === 'heygen') {
          // Note: HeyGen needs avatar_id and voice_id - will show error if not configured
          await supabase.functions.invoke('heygen-video-generator', {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
            body: { action: 'generate', analysis_id: analysisId, avatar_id: 'default', voice_id: 'default' }
          });
        } else if (enrichType === 'rsgp') {
          await supabase.functions.invoke('rsgp-compliance-generator', {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
            body: { analysis_id: analysisId, force_regenerate: true }
          });
        }
      }

      toast({
        title: "Enrichissement lancé",
        description: `L'enrichissement ${type === 'all' ? 'complet' : type.toUpperCase()} a été lancé.`,
      });
      
      // Reload after a short delay
      setTimeout(() => loadAnalyses(), 2000);
    } catch (error: any) {
      toast({
        title: "Erreur d'enrichissement",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(analysisId);
        return next;
      });
    }
  };

  const getEnrichmentBadges = (analysis: ProductAnalysis) => {
    const status = analysis.enrichment_status || {};
    const amazonStatus = status.amazon || analysis.amazon_enrichment_status;
    
    return (
      <div className="flex gap-1 flex-wrap mt-1">
        {/* Amazon Badge */}
        {amazonStatus === 'completed' && (
          <Badge variant="secondary" className="text-xs">
            <Package className="w-3 h-3 mr-1" />
            Amazon
          </Badge>
        )}
        {amazonStatus === 'processing' && (
          <Badge variant="outline" className="text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Amazon
          </Badge>
        )}
        
        {/* HeyGen Badge */}
        {status.heygen === 'completed' && (
          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
            <Video className="w-3 h-3 mr-1" />
            HeyGen
          </Badge>
        )}
        {status.heygen === 'processing' && (
          <Badge variant="outline" className="text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            HeyGen
          </Badge>
        )}
        
        {/* RSGP Badge */}
        {status.rsgp === 'completed' && (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
            <FileCheck className="w-3 h-3 mr-1" />
            RSGP
          </Badge>
        )}
        {status.rsgp === 'processing' && (
          <Badge variant="outline" className="text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            RSGP
          </Badge>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-4">
            <SubscriptionStatus />
            <UserAlertsWidget />
            <EnrichmentProgressMonitor />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <AIProviderManagement />
            
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
                <Select value={searchType} onValueChange={(v) => setSearchType(v as "url" | "ean" | "name")}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="name">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Par Nom du produit
                      </div>
                    </SelectItem>
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
                  placeholder={
                    searchType === "name" ? "Rechercher par nom de produit..." :
                    searchType === "url" ? "Rechercher par URL..." : 
                    "Rechercher par code EAN ou barcode..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Détails de l'Analyse */}
        {selectedAnalysis && (
          <>
            <Card className="mb-6 border-primary/20 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    🔍 Détails de l'Analyse
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedAnalysis(null)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Fermer
                  </Button>
                </div>
                <CardDescription>
                  Informations complètes sur le produit analysé
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DetailedAnalysisView analysis={selectedAnalysis.analysis_result} />
              </CardContent>
            </Card>

            {/* Section Re-enrichissement */}
            <Card className="mb-6 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Re-enrichir avec IA
                </CardTitle>
                <CardDescription>
                  Enrichir à nouveau ce produit avec différents providers d'IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => handleReEnrich(selectedAnalysis.id, 'lovable-ai')}
                    disabled={enrichingIds.has(selectedAnalysis.id)}
                    className="w-full"
                    variant="default"
                  >
                    {enrichingIds.has(selectedAnalysis.id) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Lovable AI
                  </Button>
                  
                  <Button
                    onClick={() => handleReEnrich(selectedAnalysis.id, 'ollama')}
                    disabled={enrichingIds.has(selectedAnalysis.id)}
                    className="w-full"
                    variant="secondary"
                  >
                    {enrichingIds.has(selectedAnalysis.id) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4 mr-2" />
                    )}
                    Ollama
                  </Button>
                  
                  <Button
                    onClick={() => handleReEnrich(selectedAnalysis.id, 'openai')}
                    disabled={enrichingIds.has(selectedAnalysis.id)}
                    className="w-full"
                    variant="outline"
                  >
                    {enrichingIds.has(selectedAnalysis.id) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    OpenAI
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  💡 Le re-enrichissement mettra à jour toutes les données du produit avec le provider sélectionné
                </p>
              </CardContent>
            </Card>
          </>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAnalyses.map((analysis) => {
                  const productName = analysis.analysis_result?.product_name || 
                                      analysis.analysis_result?.name || 
                                      "Produit sans nom";
              
              return (
                <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox
                          checked={selectedIds.has(analysis.id)}
                          onCheckedChange={() => toggleSelect(analysis.id)}
                        />
                        <div className="flex-1">
                          <CardTitle 
                            className="text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleShowDetails(analysis)}
                          >
                            {productName}
                          </CardTitle>
                          {getEnrichmentBadges(analysis)}
                        </div>
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
                    {/* Product Image Preview */}
                    {analysis.image_urls && analysis.image_urls.length > 0 && (
                      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                        <img
                          src={analysis.image_urls[0]}
                          alt={productName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                     )}
                     
                     {/* Taxonomy Badges */}
                     <TaxonomyBadges analysisId={analysis.id} />
                     
                     <div className="space-y-2">
                       {/* Main Actions Row */}
                       <div className="flex gap-2 flex-wrap">
                         <Button 
                           variant="outline" 
                           size="sm"
                           onClick={() => handleOpenDetail(analysis)}
                         >
                           Voir détails
                         </Button>
                         <ProductSummaryDialog 
                           analysis={analysis}
                           productName={productName}
                         />
                         {hasPermission('single_export') && (
                           <ProductExportMenu analysisId={analysis.id} productName={productName} />
                         )}
                         
                         {/* Quick Enrich Dropdown */}
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button 
                               variant="outline" 
                               size="sm"
                               disabled={enrichingIds.has(analysis.id)}
                             >
                               {enrichingIds.has(analysis.id) ? (
                                 <Loader2 className="w-4 h-4 animate-spin" />
                               ) : (
                                 <>
                                   <Sparkles className="w-4 h-4 mr-1" />
                                   Enrichir
                                   <ChevronDown className="w-3 h-3 ml-1" />
                                 </>
                               )}
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="bg-background z-50">
                             <DropdownMenuItem onClick={() => handleQuickEnrich(analysis.id, 'amazon')}>
                               <Package className="w-4 h-4 mr-2" />
                               Données Amazon
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleQuickEnrich(analysis.id, 'heygen')}>
                               <Video className="w-4 h-4 mr-2" />
                               Vidéo HeyGen
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleQuickEnrich(analysis.id, 'rsgp')}>
                               <FileCheck className="w-4 h-4 mr-2" />
                               Conformité RSGP
                             </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => handleQuickEnrich(analysis.id, 'all')}>
                               <Sparkles className="w-4 h-4 mr-2" />
                               Tout régénérer
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </div>
                      {/* Secondary Actions Row */}
                      <div className="flex gap-2 flex-wrap">
                        {analysis.image_urls && analysis.image_urls.length > 0 && (
                          <ProductImageGallery images={analysis.image_urls} productName={productName} />
                        )}
                        {(hasPermission('technical_analysis') || hasPermission('risk_analysis')) && (
                          <ProductAnalysisDialog productUrl={analysis.product_url} productName={productName} />
                        )}
                        <JsonViewer data={analysis.analysis_result} />
                        <Button variant="outline" size="sm" onClick={() => deleteAnalysis(analysis.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <ProductDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        product={selectedAnalysis}
      />
    </>
  );
}
