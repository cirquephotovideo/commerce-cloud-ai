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
import { Loader2, Upload, Check, AlertCircle, RefreshCw, Package } from "lucide-react";
import { toast } from "sonner";

type EnrichmentStatus = "pending" | "enriching" | "completed" | "failed";

export default function ImportedProducts() {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<EnrichmentStatus>("pending");
  const [isProcessing, setIsProcessing] = useState(false);

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
    queryKey: ['imported-products', currentTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          *,
          supplier_configurations(supplier_name),
          product_analyses(id, analysis_result, image_urls, margin_percentage)
        `)
        .eq('enrichment_status', currentTab)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: currentTab === 'enriching' ? 3000 : undefined, // Auto-refresh if enriching
  });

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
                onClick={selectedProducts.size === products?.length ? selectNone : selectAll}
                variant="outline" 
                size="sm"
              >
                {selectedProducts.size === products?.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTab} onValueChange={(v) => {
            setCurrentTab(v as EnrichmentStatus);
            setSelectedProducts(new Set());
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
                ) : (
                  products?.map(product => (
                    <Card key={product.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleSelection(product.id)}
                          disabled={tab === 'enriching' || tab === 'failed'}
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{product.product_name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {product.supplier_configurations?.supplier_name} • EAN: {product.ean || 'N/A'}
                              </p>
                            </div>
                            
                            {/* Status Badge */}
                            {product.enrichment_status === 'pending' && (
                              <Badge variant="secondary">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                En attente
                              </Badge>
                            )}
                            {product.enrichment_status === 'enriching' && (
                              <Badge>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                {product.enrichment_progress}%
                              </Badge>
                            )}
                            {product.enrichment_status === 'completed' && (
                              <Badge variant="default" className="bg-green-500">
                                <Check className="w-3 h-3 mr-1" />
                                Prêt
                              </Badge>
                            )}
                            {product.enrichment_status === 'failed' && (
                              <Badge variant="destructive">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Erreur
                              </Badge>
                            )}
                          </div>

                          {/* Progress bar */}
                          {product.enrichment_status === 'enriching' && (
                            <Progress value={product.enrichment_progress || 0} className="h-2" />
                          )}

                          {/* Enriched product info */}
                          {product.product_analyses && (
                            <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t">
                              <div>
                                <span className="text-muted-foreground">Prix achat: </span>
                                <span className="font-medium">{product.purchase_price}€</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Prix vente: </span>
                                <span className="font-medium">
                                  {(() => {
                                    const analyses = product.product_analyses as any;
                                    const analysis = Array.isArray(analyses) ? analyses[0] : analyses;
                                    return analysis?.analysis_result?.price_estimation?.estimated_price || 'N/A';
                                  })()}€
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Marge: </span>
                                <Badge variant={
                                  (() => {
                                    const analyses = product.product_analyses as any;
                                    const margin = Array.isArray(analyses) ? analyses[0]?.margin_percentage : analyses?.margin_percentage;
                                    return margin > 30 ? "default" : margin > 15 ? "secondary" : "destructive";
                                  })()
                                }>
                                  {(() => {
                                    const analyses = product.product_analyses as any;
                                    const margin = Array.isArray(analyses) ? analyses[0]?.margin_percentage : analyses?.margin_percentage;
                                    return margin?.toFixed(1) || '0';
                                  })()}%
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
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
    </div>
  );
}
