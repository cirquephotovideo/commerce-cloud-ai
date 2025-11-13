import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, ExternalLink, Package, Euro, TrendingUp, AlertCircle, Sparkles, CheckSquare, Square, X, Loader2, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SupplierProductDetail } from "./SupplierProductDetail";
import { BatchEnrichmentDialog } from "./BatchEnrichmentDialog";
import { BulkSupplierProductEditor } from "./BulkSupplierProductEditor";
import { SupplierCrossSearch } from "./SupplierCrossSearch";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export function SupplierProductsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showEnrichmentDialog, setShowEnrichmentDialog] = useState(false);
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [autoAdvancedEnrich, setAutoAdvancedEnrich] = useState(true);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [enrichingProductIds, setEnrichingProductIds] = useState<Set<string>>(new Set());
  const [searchProduct, setSearchProduct] = useState<any>(null);
  const [enrichingProduct, setEnrichingProduct] = useState<string | null>(null);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [showDeletionProgress, setShowDeletionProgress] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({
    deleted: 0,
    total: 0,
    status: 'pending' as 'pending' | 'processing' | 'completed' | 'failed'
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_configurations")
        .select("id, supplier_name")
        .order("supplier_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["supplier-products", searchQuery, statusFilter, supplierFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("supplier_products")
        .select(`
          *,
          supplier_configurations(supplier_name, id),
          product_links(id, analysis_id, link_type, confidence_score)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`ean.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,supplier_reference.ilike.%${searchQuery}%`);
      }

      if (supplierFilter !== "all") {
        query = query.eq("supplier_id", supplierFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Filter by status (after fetch for simplicity)
      let filteredData = data || [];
      if (statusFilter !== "all") {
        filteredData = filteredData.filter((p) => {
          const hasLink = p.product_links && p.product_links.length > 0;
          if (statusFilter === "linked") return hasLink;
          if (statusFilter === "unlinked") return !hasLink;
          if (statusFilter === "unlinked_with_ean") return !hasLink && p.ean;
          if (statusFilter === "unlinked_no_ean") return !hasLink && !p.ean;
          return true;
        });
      }

      return { products: filteredData, totalCount: count || 0 };
    },
  });

  const products = productsData?.products || [];
  const totalCount = productsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSelectCurrentPage = () => {
    setSelectAllMode(false);
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map(p => p.id)));
    }
  };

  const handleSelectAllFiltered = async () => {
    setSelectAllMode(true);
    
    let query = supabase
      .from("supplier_products")
      .select('id');
    
    if (searchQuery) {
      query = query.or(`ean.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,supplier_reference.ilike.%${searchQuery}%`);
    }
    if (supplierFilter !== "all") {
      query = query.eq("supplier_id", supplierFilter);
    }
    
    const { data, error } = await query;
    if (error) {
      toast.error("Erreur lors de la récupération des produits");
      return;
    }
    
    let filteredIds = data?.map(p => p.id) || [];
    
    if (statusFilter !== "all") {
      const { data: productsWithLinks } = await supabase
        .from("supplier_products")
        .select('id, ean, product_links(id)')
        .in('id', filteredIds);
      
      filteredIds = productsWithLinks?.filter(p => {
        const hasLink = p.product_links && p.product_links.length > 0;
        if (statusFilter === "linked") return hasLink;
        if (statusFilter === "unlinked") return !hasLink;
        if (statusFilter === "unlinked_with_ean") return !hasLink && p.ean;
        if (statusFilter === "unlinked_no_ean") return !hasLink && !p.ean;
        return true;
      }).map(p => p.id) || [];
    }
    
    setSelectedProductIds(new Set(filteredIds));
    toast.success(`${filteredIds.length} produit(s) sélectionné(s)`);
  };

  const handleBulkDeleteConfirm = async () => {
    setBulkDeleteDialogOpen(false);
    setShowDeletionProgress(true);
    setDeletionProgress({
      deleted: 0,
      total: selectedProductIds.size,
      status: 'processing'
    });

    try {
      const { data, error } = await supabase.functions.invoke('bulk-delete-supplier-products', {
        body: { productIds: Array.from(selectedProductIds) }
      });

      if (error) throw error;

      const jobId = data.job_id;

      const channel = supabase
        .channel(`product-deletion-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bulk_product_deletion_jobs',
            filter: `id=eq.${jobId}`
          },
          (payload: any) => {
            console.log('Deletion progress update:', payload.new);
            
            setDeletionProgress({
              deleted: payload.new.deleted_products,
              total: payload.new.total_products,
              status: payload.new.status
            });

            if (payload.new.status === 'completed') {
              toast.success(`✅ ${payload.new.deleted_products.toLocaleString()} produits supprimés`);
              channel.unsubscribe();
            }

            if (payload.new.status === 'failed' || payload.new.status === 'completed_with_errors') {
              toast.error(`❌ ${payload.new.error_message || 'Erreur lors de la suppression'}`);
              channel.unsubscribe();
            }
          }
        )
        .subscribe();

    } catch (error: any) {
      console.error('Error starting bulk deletion:', error);
      toast.error(`❌ Erreur : ${error.message}`);
      setDeletionProgress({
        deleted: 0,
        total: selectedProductIds.size,
        status: 'failed'
      });
    }
  };

  const handleToggleProduct = (productId: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedProductIds(newSet);
  };

  const handleEnrichmentComplete = () => {
    setSelectedProductIds(new Set());
    setShowEnrichmentDialog(false);
  };

  const handleSearchSimilar = (product: any) => {
    setSearchProduct(product);
  };

  const handleEnrichWithWeb = async (product: any) => {
    setEnrichingProduct(product.id);
    const loadingToast = toast.loading(`🔍 Enrichissement web pour "${product.product_name}"...`);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-supplier-product-web', {
        body: { supplier_product_id: product.id }
      });

      if (error) throw error;

      toast.success(`✅ "${data.product_name}" enrichi avec succès`, { id: loadingToast });
      
      // Refresh data
      setSelectedProduct(null);
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Enrichment error:', error);
      toast.error(`❌ Échec : ${error.message}`, { id: loadingToast });
    } finally {
      setEnrichingProduct(null);
    }
  };

  const getStatusBadge = (product: any) => {
    const hasLink = product.product_links && product.product_links.length > 0;
    
    if (hasLink) {
      const linkType = product.product_links[0].link_type;
      return (
        <Badge className="bg-green-600 text-white">
          <Link2 className="h-3 w-3 mr-1" />
          {linkType === "auto" ? "Auto-lié" : linkType === "manual" ? "Lié" : "Suggéré"}
        </Badge>
      );
    }
    
    return <Badge variant="secondary">Non lié</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span>Produits Fournisseurs</span>
              <Badge variant="outline">{totalCount}</Badge>
              {totalPages > 1 && (
                <span className="text-sm text-muted-foreground ml-2">
                  Page {page + 1}/{totalPages}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 border-r pr-4">
                <Switch 
                  id="auto-enrich-supplier"
                  checked={autoAdvancedEnrich}
                  onCheckedChange={setAutoAdvancedEnrich}
                />
                <Label htmlFor="auto-enrich-supplier" className="text-sm cursor-pointer">
                  Enrichissements avancés
                  <span className="text-xs text-muted-foreground block">
                    (Specs, Description, Coûts, RSGP via Ollama)
                  </span>
                </Label>
              </div>
              {autoAdvancedEnrich && (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Modèle IA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🔄 Auto (Fallback)</SelectItem>
                    <SelectItem value="gpt-oss:120b-cloud">🌩️ Ollama GPT-OSS 120B</SelectItem>
                    <SelectItem value="qwen:110b-cloud">🌩️ Ollama Qwen 110B</SelectItem>
                    <SelectItem value="google/gemini-2.5-flash">⚡ Gemini 2.5 Flash</SelectItem>
                    <SelectItem value="openai/gpt-5-mini">🤖 GPT-5 Mini</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={supplierFilter} onValueChange={(val) => { setSupplierFilter(val); setPage(0); }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les fournisseurs</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="linked">✅ Liés</SelectItem>
                  <SelectItem value="unlinked">⏳ Non liés</SelectItem>
                  <SelectItem value="unlinked_with_ean">🔄 Non liés avec EAN</SelectItem>
                  <SelectItem value="unlinked_no_ean">⚠️ Non liés sans EAN</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par EAN, nom..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products?.length > 0 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Tout sélectionner ▼
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleSelectCurrentPage}>
                    📄 Page actuelle ({products.length} produits)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSelectAllFiltered}>
                    🌐 Tous les produits filtrés ({totalCount.toLocaleString()} produits)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedProductIds.size > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {selectAllMode 
                    ? `${selectedProductIds.size.toLocaleString()} sélectionné(s) (toutes pages)`
                    : `${selectedProductIds.size} sélectionné(s) (page actuelle)`
                  }
                </Badge>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Chargement...
            </div>
          ) : products?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products?.map((product) => (
                <Card 
                  key={product.id} 
                  className="hover:shadow-md transition-all border-l-4 border-l-primary/20 hover:border-l-primary"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedProductIds.has(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0"
                      />
                      {/* Nom du produit - Colonne principale */}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <h3 className="font-semibold text-base mb-1 truncate">
                          {product.product_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {product.supplier_configurations?.supplier_name}
                        </p>
                      </div>

                      {/* EAN - Bien visible */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">EAN</span>
                        {product.ean ? (
                          <p className="text-base font-mono font-semibold">
                            {product.ean}
                          </p>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Manquant
                          </Badge>
                        )}
                      </div>

                      {/* Prix - Bien visible */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Prix d'achat</span>
                        <p className="text-lg font-bold text-primary">
                          {product.purchase_price?.toFixed(2)} €
                        </p>
                      </div>

                      {/* Stock */}
                      <div className="flex flex-col items-center gap-1 min-w-[80px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Stock</span>
                        <Badge variant="outline" className="text-sm">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {product.stock_quantity || "0"}
                        </Badge>
                      </div>

                      {/* Statut de liaison */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Statut</span>
                        {getStatusBadge(product)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!product.product_links || product.product_links.length === 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              
                              const { data: { user } } = await supabase.auth.getUser();
                              if (!user) {
                                toast.error("Non authentifié");
                                return;
                              }

                              setEnrichingProductIds(prev => new Set(prev).add(product.id));

                              try {
                                const { data: newAnalysis, error: analysisError } = await supabase
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
                                      supplier_reference: product.supplier_reference || ''
                                    },
                                    enrichment_status: {
                                      base_analysis: 'pending',
                                      specifications: 'pending',
                                      technical_description: 'pending',
                                      cost_analysis: 'pending',
                                      rsgp: 'pending'
                                    }
                                  })
                                  .select('id')
                                  .single();

                                if (analysisError) throw analysisError;

                                if (autoAdvancedEnrich && newAnalysis?.id) {
                                  await toast.promise(
                                    supabase.functions.invoke('enrich-all', {
                                      body: {
                                        analysisId: newAnalysis.id,
                                        productData: {
                                          name: product.product_name,
                                          ean: product.ean,
                                          category: 'Produit fournisseur',
                                          description: product.description || ''
                                        },
                                        purchasePrice: product.purchase_price,
                                        preferred_model: selectedModel !== 'auto' ? selectedModel : undefined
                                      }
                                    }),
                                    {
                                      loading: `🔄 Enrichissement de ${product.product_name} avec ${selectedModel === 'auto' ? 'fallback auto' : selectedModel}...`,
                                      success: (result) => {
                                        const { data } = result;
                                        if (data?.success) {
                                          return `✅ ${data.successCount}/4 enrichissements réussis`;
                                        }
                                        return '⚠️ Enrichissements partiels';
                                      },
                                      error: (err) => `❌ Échec : ${err.message}`
                                    }
                                  );
                                } else {
                                  toast.success("✅ Analyse créée (sans enrichissements)");
                                }

                                window.location.href = `/dashboard?filter=recent`;
                              } catch (error: any) {
                                toast.error("Erreur: " + error.message);
                              } finally {
                                setEnrichingProductIds(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(product.id);
                                  return newSet;
                                });
                              }
                            }}
                            title="Créer une analyse produit"
                            className="gap-2"
                            disabled={enrichingProductIds.has(product.id)}
                          >
                            {enrichingProductIds.has(product.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Enrichissement...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Créer analyse
                              </>
                            )}
                          </Button>
                        ) : null}
                        {product.supplier_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(product.supplier_url, "_blank");
                            }}
                            title="Voir sur le site fournisseur"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Affichage {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} sur {totalCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Suivant →
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Floating action bar */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <Card className="shadow-2xl border-2 border-primary">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  {selectedProductIds.size} produit{selectedProductIds.size > 1 ? "s" : ""} sélectionné{selectedProductIds.size > 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-6 w-px bg-border" />
              <Button
                onClick={() => setShowEnrichmentDialog(true)}
                className="gap-2"
                disabled={selectedProductIds.size > 500}
              >
                <Sparkles className="h-4 w-4" />
                Enrichir
              </Button>
              <Button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    toast.error("Non authentifié");
                    return;
                  }

                  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
                  toast.info(`🔄 Enrichissement de ${selectedProducts.length} produit(s)...`);

                  let successCount = 0;
                  let failCount = 0;

                  for (const product of selectedProducts) {
                    try {
                      const { data: newAnalysis, error: analysisError } = await supabase
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
                            ean: product.ean
                          },
                          enrichment_status: {
                            base_analysis: 'pending',
                            specifications: 'pending',
                            technical_description: 'pending',
                            cost_analysis: 'pending',
                            rsgp: 'pending'
                          }
                        })
                        .select('id')
                        .single();

                      if (analysisError) throw analysisError;

                      if (autoAdvancedEnrich && newAnalysis?.id) {
                        await supabase.functions.invoke('enrich-all', {
                          body: {
                            analysisId: newAnalysis.id,
                            productData: {
                              name: product.product_name,
                              ean: product.ean,
                              category: 'Produit fournisseur'
                            },
                            purchasePrice: product.purchase_price,
                            preferred_model: selectedModel !== 'auto' ? selectedModel : undefined
                          }
                        });
                      }

                      successCount++;
                    } catch (err) {
                      console.error('Bulk enrichment error:', err);
                      failCount++;
                    }
                  }

                  toast.success(`✅ ${successCount} produit(s) enrichi(s) ${failCount > 0 ? `(${failCount} échec(s))` : ''}`);
                  setSelectedProductIds(new Set());
                }}
                className="gap-2"
                variant="secondary"
              >
                <Sparkles className="h-4 w-4" />
                Créer analyses pour la sélection ({selectedProductIds.size})
              </Button>
              <Button
                onClick={() => setShowBulkEditor(true)}
                variant="outline"
                className="gap-2"
              >
                Modifier en masse
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProductIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedProduct && (
        <SupplierProductDetail
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
          onSearchSimilar={handleSearchSimilar}
          onEnrichWithWeb={handleEnrichWithWeb}
        />
      )}

      <SupplierCrossSearch
        product={searchProduct}
        open={!!searchProduct}
        onOpenChange={(open) => !open && setSearchProduct(null)}
      />

      <BatchEnrichmentDialog
        open={showEnrichmentDialog}
        onOpenChange={setShowEnrichmentDialog}
        selectedProducts={selectedProductIds}
        onComplete={handleEnrichmentComplete}
      />

      <BulkSupplierProductEditor
        open={showBulkEditor}
        onOpenChange={setShowBulkEditor}
        selectedProducts={selectedProductIds}
        onComplete={handleEnrichmentComplete}
      />
    </>
  );
}
