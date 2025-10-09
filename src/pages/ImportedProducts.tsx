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
import { Loader2, Upload, Check, AlertCircle, RefreshCw, Package, Eye, Filter, Link2, Sparkles, Table2, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatMargin, getMarginColor, getStatusVariant, extractAnalysisData, getImageUrl } from "@/lib/formatters";
import { ProductsTable } from "@/components/ProductsTable";
import { BatchEnrichmentDialog } from "@/components/BatchEnrichmentDialog";
import { AutoLinkDialog } from "@/components/AutoLinkDialog";
import { ProductDetailModal } from "@/components/ProductDetailModal";

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
          product_analyses(id, analysis_result, image_urls, margin_percentage)
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
            <div className="flex gap-2">
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
              <div className="flex gap-2">
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
            </div>
          </CardTitle>
        </CardHeader>
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun produit dans cette catégorie</p>
                  </div>
                ) : viewMode === 'table' ? (
                  <ProductsTable
                    products={products}
                    selectedProducts={selectedProducts}
                    onToggleSelection={toggleSelection}
                    onSelectAll={() => selectedProducts.size === products?.length ? selectNone() : selectAll()}
                    onViewDetails={setSelectedProductDetail}
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
                            disabled={tab === 'enriching' || tab === 'failed'}
                          />
                          
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                  <h3 className="font-semibold">{product.product_name}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  🏢 {product.supplier_configurations?.supplier_name} • 📊 EAN: {product.ean || 'N/A'}
                                </p>
                              </div>
                              
                              {/* Status Card */}
                              {product.enrichment_status === 'pending' && (
                                <div className="bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-500 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-orange-500" />
                                    <div>
                                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">En attente</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {product.enrichment_status === 'enriching' && (
                                <div className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-2 rounded min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">En cours</p>
                                      <Progress value={product.enrichment_progress || 0} className="h-1 mt-1" />
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{product.enrichment_progress || 0}%</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {product.enrichment_status === 'completed' && (
                                <div className="bg-green-50 dark:bg-green-950 border-l-4 border-green-500 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <div>
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-300">Prêt à exporter</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {product.enrichment_status === 'failed' && (
                                <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 p-2 rounded">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                    <div>
                                      <p className="text-xs font-semibold text-red-700 dark:text-red-300">Erreur</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Enriched Data Grid */}
                            {product.product_analyses && (
                              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                {/* Row 1: Pricing */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">💰 Prix achat</span>
                                    <span className="font-semibold text-sm">{product.purchase_price?.toFixed(2)}€</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">💵 Prix vente</span>
                                    <span className="font-semibold text-sm text-green-600 dark:text-green-400">
                                      {estimatedPrice ? `${estimatedPrice}€` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">📈 Marge</span>
                                    <Badge variant={margin > 30 ? "default" : margin > 15 ? "secondary" : "destructive"}>
                                      {margin ? `${margin.toFixed(1)}%` : '0%'}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Row 2: Category & Market */}
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">🏷️ Catégorie: </span>
                                    <span className="font-medium">{category || 'Non catégorisé'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">🌐 Marché Amazon: </span>
                                    <span className="font-medium">{ranking ? `Top ${ranking}%` : 'N/A'}</span>
                                  </div>
                                </div>

                                {/* Row 3: Images */}
                                {imageCount > 0 && (
                                  <div className="flex items-center gap-4 text-xs pt-2 border-t">
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">🖼️ Images:</span>
                                      <Badge variant="outline">{imageCount}</Badge>
                                    </div>
                                    <div className="flex gap-1">
                                      {analysis.image_urls.slice(0, 3).map((url: string, idx: number) => (
                                        <img
                                          key={idx}
                                          src={url}
                                          alt=""
                                          className="w-8 h-8 rounded border object-cover"
                                        />
                                      ))}
                                      {imageCount > 3 && (
                                        <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center text-xs font-medium">
                                          +{imageCount - 3}
                                        </div>
                                      )}
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setSelectedProductDetail(product.id)}
                                      className="ml-auto"
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      Détails
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
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
    </div>
  );
}
