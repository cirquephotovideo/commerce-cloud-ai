import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, ExternalLink, Package, Euro, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupplierProductDetail } from "./SupplierProductDetail";

export function SupplierProductsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
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
          return true;
        });
      }

      return { products: filteredData, totalCount: count || 0 };
    },
  });

  const products = productsData?.products || [];
  const totalCount = productsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

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
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="linked">✅ Liés</SelectItem>
                  <SelectItem value="unlinked">⏳ Non liés</SelectItem>
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
                  className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary/20 hover:border-l-primary"
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      {/* Nom du produit - Colonne principale */}
                      <div className="flex-1 min-w-0">
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

      {selectedProduct && (
        <SupplierProductDetail
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
        />
      )}
    </>
  );
}
