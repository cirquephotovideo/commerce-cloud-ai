import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Check, AlertCircle, RefreshCw, Package, Eye, Filter, Link2, Sparkles, Table2, LayoutGrid, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatMargin, getMarginColor, getStatusVariant, extractAnalysisData, getImageUrl } from "@/lib/formatters";
import { ProductsTable } from "@/components/ProductsTable";
import { BatchEnrichmentDialog } from "@/components/BatchEnrichmentDialog";
import { AutoLinkDialog } from "@/components/AutoLinkDialog";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { EnrichmentProgressMonitor } from "@/components/EnrichmentProgressMonitor";

type EnrichmentStatus = "pending" | "enriching" | "completed" | "failed";

export default function ImportedProducts() {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<EnrichmentStatus>("pending");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<string | null>(null);
  const [filterMargin, setFilterMargin] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchEnrichmentOpen, setBatchEnrichmentOpen] = useState(false);
  const [autoLinkOpen, setAutoLinkOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [autoAdvancedEnrich, setAutoAdvancedEnrich] = useState(true);
  const [selectedModel, setSelectedModel] = useState<'auto' | 'gpt-oss:120b-cloud' | 'qwen:110b-cloud' | 'google/gemini-2.5-flash' | 'openai/gpt-5-mini'>('auto');
  const [enrichingProductIds, setEnrichingProductIds] = useState<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 50;
  
  // Get current user
  const [userId, setUserId] = useState<string>('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['import-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_products')
        .select('enrichment_status', { count: 'exact' });
      
      if (error) throw error;

      const statusCounts = data?.reduce((acc: any, row: any) => {
        acc[row.enrichment_status] = (acc[row.enrichment_status] || 0) + 1;
        return acc;
      }, {});

      return {
        total: data?.length || 0,
        pending: statusCounts?.pending || 0,
        enriching: statusCounts?.enriching || 0,
        completed: statusCounts?.completed || 0,
        failed: statusCounts?.failed || 0,
      };
    },
    refetchInterval: 5000, // Refresh every 5s
  });

  // Fetch products by status
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['imported-products', currentTab, filterMargin, filterCategory],
    queryFn: async () => {
      let query = supabase
        .from('supplier_products')
        .select(`
          *,
          supplier_configurations(supplier_name),
          product_analyses(
            id, 
            analysis_result, 
            image_urls, 
            margin_percentage,
            amazon_product_data(images)
          )
        `)
        .eq('enrichment_status', currentTab)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Apply filters and search
      let filteredData = data || [];
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(p => 
          p.product_name?.toLowerCase().includes(query) ||
          p.ean?.toLowerCase().includes(query) ||
          p.supplier_configurations?.supplier_name?.toLowerCase().includes(query)
        );
      }
      
      if (filterMargin !== 'all' && currentTab === 'completed') {
        filteredData = filteredData.filter(p => {
          const analyses = p.product_analyses as any;
          const margin = Array.isArray(analyses) ? analyses[0]?.margin_percentage : analyses?.margin_percentage;
          if (!margin) return false;
          
          if (filterMargin === 'high') return margin > 30;
          if (filterMargin === 'medium') return margin >= 15 && margin <= 30;
          if (filterMargin === 'low') return margin < 15;
          return true;
        });
      }
      
      if (filterCategory !== 'all' && currentTab === 'completed') {
        filteredData = filteredData.filter(p => {
          const analyses = p.product_analyses as any;
          const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
          const category = analysis?.analysis_result?.category || '';
          return category.toLowerCase().includes(filterCategory.toLowerCase());
        });
      }
      
      return filteredData;
    },
    refetchInterval: currentTab === 'enriching' ? 3000 : undefined,
  });

  // Get unique categories for filter
  const uniqueCategories = products
    ?.map(p => {
      const analyses = p.product_analyses as any;
      const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
      return analysis?.analysis_result?.category || '';
    })
    .filter((cat, idx, arr) => cat && arr.indexOf(cat) === idx) || [];

  // Toggle selection
  const toggleSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  // Select all
  const selectAll = () => {
    const allIds = products?.map(p => p.id) || [];
    setSelectedProducts(new Set(allIds));
  };

  // Deselect all
  const selectNone = () => {
    setSelectedProducts(new Set());
  };

  // Create analysis and optionally enrich
  const createAnalysisAndMaybeEnrich = async (product: any) => {
    const productId = product.id;
    setEnrichingProductIds(prev => new Set(prev).add(productId));
    
    console.log('[ImportedProducts] Creating analysis for:', product.product_name, product.id);
    console.log('[ImportedProducts] Auto-enrich enabled:', autoAdvancedEnrich);
    console.log('[ImportedProducts] Selected model:', selectedModel);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Create product_analyses entry
      const { data: analysisData, error: analysisError } = await supabase
        .from('product_analyses')
        .insert({
          ean: product.ean,
          purchase_price: product.purchase_price,
          purchase_currency: 'EUR',
          supplier_product_id: product.id,
          user_id: user.id,
          product_url: product.supplier_url || '',
          analysis_result: {
            name: product.product_name,
            category: 'Produit fournisseur',
            ean: product.ean,
            supplier_reference: product.supplier_reference
          },
          enrichment_status: {
            base_analysis: 'pending',
            specifications: 'pending',
            technical_description: 'pending',
            cost_analysis: 'pending',
            rsgp: 'pending'
          }
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      console.log('[ImportedProducts] Analysis created:', analysisData.id);

      // Update supplier_product enrichment_status
      await supabase
        .from('supplier_products')
        .update({ enrichment_status: 'enriching' })
        .eq('id', productId);

      // If auto-enrichment is enabled, call enrich-all
      if (autoAdvancedEnrich) {
        console.log('[ImportedProducts] Calling enrich-all with:', {
          analysisId: analysisData.id,
          productName: product.product_name,
          model: selectedModel
        });

        const enrichPromise = supabase.functions.invoke('enrich-all', {
          body: {
            analysisId: analysisData.id,
            productData: {
              name: product.product_name,
              ean: product.ean,
              category: 'Produit fournisseur',
              description: product.description || ''
            },
            purchasePrice: product.purchase_price,
            preferred_model: selectedModel !== 'auto' ? selectedModel : undefined
          }
        }).then(response => {
          console.log('[ImportedProducts] enrich-all response:', response);
          if (response.error) {
            console.error('[ImportedProducts] enrich-all error:', response.error);
            throw response.error;
          }
          return response;
        });

        await toast.promise(enrichPromise, {
          loading: `Enrichissement de ${product.product_name}...`,
          success: (result) => {
            const data = result.data;
            const completed = data?.summary?.completed || 0;
            console.log('[ImportedProducts] Enrichment completed:', data?.summary);
            return `✅ ${completed}/4 enrichissements réussis`;
          },
          error: (err) => {
            console.error('[ImportedProducts] Enrichment error details:', {
              message: err.message,
              status: err.status,
              error: err
            });
            
            // Handle specific error codes
            if (err.status === 402) {
              return "❌ Crédits insuffisants - Rechargez votre compte";
            }
            if (err.status === 429) {
              return "❌ Limite de requêtes atteinte - Réessayez plus tard";
            }
            if (err.status === 503) {
              return "❌ Service temporairement indisponible";
            }
            
            return `❌ Erreur: ${err.message || 'Inconnu'}`;
          }
        });

        // Log enrichment completion
        console.log('[ImportedProducts] enrich-all completed for product:', {
          productName: product.product_name,
          analysisId: analysisData.id
        });
      } else {
        toast.success(`✅ Analyse créée pour ${product.product_name}`);
      }

      // Force refresh data
      await refetch();
      console.log('[ImportedProducts] Data refreshed');
      
    } catch (error: any) {
      console.error('[ImportedProducts] Error creating analysis:', error);
      toast.error(`Erreur: ${error.message || 'Impossible de créer l\'analyse'}`);
    } finally {
      setEnrichingProductIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Delete a product
  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produit supprimé avec succès');
      
      // Remove from selection if selected
      if (selectedProducts.has(productId)) {
        const newSelection = new Set(selectedProducts);
        newSelection.delete(productId);
        setSelectedProducts(newSelection);
      }
      
      // Refresh list
      refetch();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Erreur lors de la suppression du produit');
    }
  };

  // Trigger background enrichment
  const handleProcessEnrichments = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-pending-enrichments');
      
      if (error) throw error;
      
      toast.success(`✅ Enrichissement lancé: ${data.enriched} produits traités`);
      refetch();
    } catch (error) {
      console.error('Error processing enrichments:', error);
      toast.error("Erreur lors de l'enrichissement automatique");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk export avec feedback détaillé
  const handleBulkExport = async (platform: string) => {
    const selectedAnalysisIds = products
      ?.filter(p => {
        const analyses = p.product_analyses as any;
        return selectedProducts.has(p.id) && analyses && (Array.isArray(analyses) ? analyses[0]?.id : analyses.id);
      })
      .map(p => {
        const analyses = p.product_analyses as any;
        return Array.isArray(analyses) ? analyses[0].id : analyses.id;
      }) || [];

    if (selectedAnalysisIds.length === 0) {
      toast.error("❌ Aucun produit enrichi sélectionné");
      return;
    }

    try {
      toast.info(`📤 Export de ${selectedAnalysisIds.length} produits vers ${platform}...`);
      
      const { data, error } = await supabase.functions.invoke(`export-to-${platform}`, {
        body: { analysis_ids: selectedAnalysisIds }
      });

      if (error) throw error;
      
      // ✅ Feedback détaillé
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const errorCount = data.results?.filter((r: any) => !r.success).length || 0;
      
      toast.success(
        `✅ Export terminé !\n` +
        `• ${successCount} créés\n` +
        `• ${errorCount || 0} erreurs`
      );
      
      // Mettre à jour last_exported_at pour les produits exportés
      await supabase
        .from('product_analyses')
        .update({ 
          last_exported_at: new Date().toISOString()
        })
        .in('id', selectedAnalysisIds);
      
      refetch();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`❌ Erreur lors de l'export: ${error.message}`);
    }
  };

  // Phase 6.2: Notifications temps réel
  useEffect(() => {
    const channel = supabase
      .channel('supplier_enrichment_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'supplier_products',
          filter: 'enrichment_status=eq.completed',
        },
        (payload) => {
          toast.success(`✅ ${payload.new.product_name} est maintenant enrichi !`);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground">Total importés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-500">{stats?.pending || 0}</div>
            <p className="text-sm text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-500">{stats?.enriching || 0}</div>
            <p className="text-sm text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-500">{stats?.completed || 0}</div>
            <p className="text-sm text-muted-foreground">Prêts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Produits Importés
            </span>
            <div className="flex gap-3 items-center">
              {/* Auto-enrichment controls */}
              <div className="flex items-center gap-2 border-r pr-3">
                <Switch
                  id="auto-enrich"
                  checked={autoAdvancedEnrich}
                  onCheckedChange={setAutoAdvancedEnrich}
                />
                <Label htmlFor="auto-enrich" className="text-sm cursor-pointer">
                  Enrichissements avancés
                </Label>
              </div>
              
              {autoAdvancedEnrich && (
                <Select value={selectedModel} onValueChange={(v: any) => setSelectedModel(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🔄 Auto (Ollama + fallback)</SelectItem>
                    <SelectItem value="gpt-oss:120b-cloud">🧠 GPT-OSS 120B (Cloud)</SelectItem>
                    <SelectItem value="qwen:110b-cloud">🚀 Qwen 110B (Cloud)</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">✨ Gemini Flash</SelectItem>
                    <SelectItem value="openai/gpt-5-mini">🤖 GPT-5 Mini</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <Button size="sm" variant="outline" onClick={() => setAutoLinkOpen(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Lier automatiquement
              </Button>
              {selectedProducts.size > 0 && (
                <Button size="sm" onClick={() => setBatchEnrichmentOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enrichir ({selectedProducts.size})
                </Button>
              )}
              {stats?.pending > 0 && (
                <Button 
                  onClick={handleProcessEnrichments}
                  disabled={isProcessing}
                  variant="outline"
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enrichissement...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Lancer enrichissement ({stats.pending})
                    </>
                  )}
                </Button>
              )}
              <Button 
                size="sm"
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
              >
                <Table2 className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        {/* Enrichment Progress Monitor - Toujours visible pour afficher les tâches des 24 dernières heures */}
        <div className="px-6 pt-4">
          <EnrichmentProgressMonitor />
        </div>
        
        <CardContent>
          {/* Search and Filters */}
          <div className="flex gap-2 mb-4 items-center flex-wrap">
            <Input
              placeholder="Rechercher par nom, EAN, fournisseur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            
            {currentTab === 'completed' && (
              <>
                <span className="text-sm text-muted-foreground">Filtres:</span>
              
              <Select value={filterMargin} onValueChange={(v) => setFilterMargin(v as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Marge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marges</SelectItem>
                  <SelectItem value="high">🟢 &gt; 30%</SelectItem>
                  <SelectItem value="medium">🟡 15-30%</SelectItem>
                  <SelectItem value="low">🔴 &lt; 15%</SelectItem>
                </SelectContent>
              </Select>

              {uniqueCategories.length > 0 && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {uniqueCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(filterMargin !== 'all' || filterCategory !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFilterMargin('all');
                    setFilterCategory('all');
                  }}
                >
                  Réinitialiser
                </Button>
              )}
              </>
            )}
          </div>
          
          <Tabs value={currentTab} onValueChange={(v) => {
            setCurrentTab(v as EnrichmentStatus);
            setSelectedProducts(new Set());
            setFilterMargin('all');
            setFilterCategory('all');
          }}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">
                ⏳ En attente ({stats?.pending || 0})
              </TabsTrigger>
              <TabsTrigger value="enriching">
                🔄 En cours ({stats?.enriching || 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                ✅ Prêts ({stats?.completed || 0})
              </TabsTrigger>
              <TabsTrigger value="failed">
                ❌ Erreurs ({stats?.failed || 0})
              </TabsTrigger>
            </TabsList>

            {(['pending', 'enriching', 'completed', 'failed'] as EnrichmentStatus[]).map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  </div>
                ) : products?.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {tab === 'pending' && '⏳ Aucun produit en attente'}
                        {tab === 'enriching' && '🔄 Aucun enrichissement en cours'}
                        {tab === 'completed' && '✅ Aucun produit enrichi'}
                        {tab === 'failed' && '❌ Aucune erreur'}
                      </h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        {tab === 'pending' && 'Importez des produits depuis vos fournisseurs pour commencer l\'enrichissement automatique.'}
                        {tab === 'enriching' && 'Les produits en cours d\'enrichissement apparaîtront ici.'}
                        {tab === 'completed' && 'Les produits enrichis et prêts à être exportés apparaîtront ici.'}
                        {tab === 'failed' && 'Les produits ayant rencontré des erreurs lors de l\'enrichissement apparaîtront ici.'}
                      </p>
                    </div>
                  </div>
                ) : viewMode === 'table' ? (
                  <ProductsTable
                    products={products}
                    selectedProducts={selectedProducts}
                    onToggleSelection={toggleSelection}
                    onSelectAll={() => selectedProducts.size === products?.length ? selectNone() : selectAll()}
                    onViewDetails={setSelectedProductDetail}
                    showCreateAnalysisAction={true}
                    onCreateAnalysis={createAnalysisAndMaybeEnrich}
                    enrichingProductIds={enrichingProductIds}
                    onDeleteProduct={deleteProduct}
                  />
                ) : (
                  products?.map(product => {
                    const analyses = product.product_analyses as any;
                    const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
                    const margin = analysis?.margin_percentage;
                    const estimatedPrice = analysis?.analysis_result?.price_estimation?.estimated_price;
                    const category = analysis?.analysis_result?.category;
                    const ranking = analysis?.analysis_result?.amazon_ranking;
                    const imageCount = analysis?.image_urls?.length || 0;
                    
                    return (
                      <Card key={product.id} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => toggleSelection(product.id)}
                            className="mt-1"
                          />
                          
                          <div className="flex-1 space-y-3">
                            {/* Product Name */}
                            <h3 className="font-semibold text-lg">{product.product_name}</h3>
                            
                            {/* Compact Info Table */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">EAN:</span>
                                <span className="ml-1 font-medium">{product.ean || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Prix achat:</span>
                                <span className="ml-1 font-medium">{formatPrice(product.purchase_price)}</span>
                              </div>
                              {estimatedPrice && (
                                <div>
                                  <span className="text-muted-foreground">Prix vente:</span>
                                  <span className="ml-1 font-medium">{formatPrice(estimatedPrice)}</span>
                                </div>
                              )}
                              {margin !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Marge:</span>
                                  <Badge variant={getMarginColor(margin)} className="ml-1">
                                    {formatMargin(margin)}
                                  </Badge>
                                </div>
                              )}
                            </div>

                            {/* Additional Info */}
                            <div className="flex flex-wrap gap-2 text-xs">
                              {category && (
                                <Badge variant="secondary">📊 {category}</Badge>
                              )}
                              {imageCount > 0 && (
                                <Badge variant="outline">📷 {imageCount} images</Badge>
                              )}
                              {product.supplier_configurations?.supplier_name && (
                                <Badge variant="outline">
                                  🏢 {product.supplier_configurations.supplier_name}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Enrichment Status Badges */}
                            {analysis && (
                              <div className="flex flex-wrap gap-2 text-xs mt-2">
                                {analysis.specifications && (
                                  <Badge variant="default">✅ Specs</Badge>
                                )}
                                {analysis.long_description && (
                                  <Badge variant="default">✅ Description</Badge>
                                )}
                                {analysis.cost_analysis && (
                                  <Badge variant="default">✅ Coûts</Badge>
                                )}
                                {analysis.rsgp_compliance && (
                                  <Badge variant="default">✅ RSGP</Badge>
                                )}
                              </div>
                            )}
                             
                             {/* Action Buttons */}
                             <div className="flex gap-2">
                               {!analysis ? (
                                 <Button 
                                   variant="default"
                                   size="sm"
                                   onClick={() => createAnalysisAndMaybeEnrich(product)}
                                   disabled={enrichingProductIds.has(product.id)}
                                 >
                                   {enrichingProductIds.has(product.id) ? (
                                     <>
                                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                       Création...
                                     </>
                                   ) : (
                                     "Créer analyse"
                                   )}
                                 </Button>
                               ) : (
                                 <Button 
                                   variant="outline" 
                                   size="sm"
                                   onClick={() => setSelectedProductDetail(product.id)}
                                 >
                                   <Eye className="w-4 h-4 mr-2" />
                                   Voir les détails
                                 </Button>
                               )}
                               
                               <Button 
                                 variant="destructive" 
                                 size="sm"
                                 onClick={() => {
                                   if (confirm(`Êtes-vous sûr de vouloir supprimer "${product.product_name}" ?`)) {
                                     deleteProduct(product.id);
                                   }
                                 }}
                               >
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </div>
                           </div>
                         </div>
                       </Card>
                    );
                  })
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Bulk Actions Footer */}
          {selectedProducts.size > 0 && currentTab === 'completed' && (
            <div className="mt-6 p-4 bg-accent rounded-lg flex items-center justify-between">
              <span className="font-medium">
                {selectedProducts.size} produit(s) sélectionné(s)
              </span>
              
              <div className="flex gap-2">
                <Button onClick={() => handleBulkExport('odoo')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Exporter vers Odoo
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Autres plateformes</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {['shopify', 'woocommerce', 'prestashop', 'magento', 'salesforce', 'sap', 'deliveroo', 'uber_eats', 'just_eat'].map(platform => (
                      <DropdownMenuItem key={platform} onClick={() => handleBulkExport(platform)}>
                        {platform}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Enrichment Dialog */}
      <BatchEnrichmentDialog
        open={batchEnrichmentOpen}
        onOpenChange={setBatchEnrichmentOpen}
        selectedProducts={selectedProducts}
        onComplete={() => {
          refetch();
          setSelectedProducts(new Set());
        }}
      />

      {/* Auto Link Dialog */}
      <AutoLinkDialog
        open={autoLinkOpen}
        onOpenChange={setAutoLinkOpen}
        userId={userId}
        onComplete={() => refetch()}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        open={!!selectedProductDetail}
        onOpenChange={(open) => !open && setSelectedProductDetail(null)}
        product={products?.find(p => p.id === selectedProductDetail)}
        onExport={(platform) => {
          const product = products?.find(p => p.id === selectedProductDetail);
          if (product) {
            const { analysisId } = extractAnalysisData(product);
            if (analysisId) {
              handleBulkExport(platform);
            }
          }
        }}
      />

      {/* Floating Action Bar */}
      {selectedProducts.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom">
          <span className="font-semibold">
            {selectedProducts.size} produit{selectedProducts.size > 1 ? 's' : ''} sélectionné{selectedProducts.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={selectNone}
            >
              Désélectionner
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBatchEnrichmentOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Enrichir en masse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
