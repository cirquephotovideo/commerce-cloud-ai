import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, ExternalLink, Package, Euro, TrendingUp, AlertCircle, Sparkles, CheckSquare, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SupplierProductDetail } from "./SupplierProductDetail";
import { BatchEnrichmentDialog } from "./BatchEnrichmentDialog";
import { BulkSupplierProductEditor } from "./BulkSupplierProductEditor";

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

  const handleSelectAll = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map(p => p.id)));
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
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="gap-2"
              >
                {selectedProductIds.size === products.length ? (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Tout désélectionner
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" />
                    Tout sélectionner
                  </>
                )}
              </Button>
              {selectedProductIds.size > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {selectedProductIds.size} sélectionné{selectedProductIds.size > 1 ? "s" : ""}
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
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) throw new Error("Non authentifié");

                                // Create product_analyses
                                const { data: newAnalysis, error: analysisError } = await supabase
                                  .from('product_analyses')
                                  .insert({
                                    user_id: user.id,
                                    ean: product.ean,
                                    purchase_price: product.purchase_price,
                                    purchase_currency: 'EUR',
                                    supplier_product_id: product.id,
                                    analysis_result: {
                                      name: product.product_name,
                                    },
                                    needs_enrichment: true
                                  })
                                  .select('id')
                                  .single();

                                if (analysisError) throw analysisError;

                                // Create enrichment queue
                                await supabase.from('enrichment_queue').insert({
                                  user_id: user.id,
                                  analysis_id: newAnalysis.id,
                                  supplier_product_id: product.id,
                                  enrichment_type: ['specifications', 'description'],
                                  priority: 'normal',
                                  status: 'pending'
                                });

                                toast.success("Analyse créée et mise en file d'enrichissement");
                                window.location.href = `/dashboard?filter=recent`;
                              } catch (error: any) {
                                toast.error("Erreur: " + error.message);
                              }
                            }}
                            title="Créer une analyse produit"
                            className="gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            Créer analyse
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
        />
      )}

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
