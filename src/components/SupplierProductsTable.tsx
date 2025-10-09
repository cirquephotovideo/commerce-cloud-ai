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
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["supplier-products", searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("supplier_products")
        .select(`
          *,
          supplier_configurations(supplier_name),
          product_links(id, analysis_id, link_type, confidence_score)
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`ean.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,supplier_reference.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by status
      if (statusFilter !== "all") {
        return data?.filter((p) => {
          const hasLink = p.product_links && p.product_links.length > 0;
          if (statusFilter === "linked") return hasLink;
          if (statusFilter === "unlinked") return !hasLink;
          return true;
        });
      }

      return data;
    },
  });

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
              <Badge variant="outline">{products?.length || 0}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  onChange={(e) => setSearchQuery(e.target.value)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products?.map((product) => (
                <Card 
                  key={product.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header avec statut */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate mb-1">
                            {product.product_name}
                          </h3>
                          {product.ean && (
                            <p className="text-xs font-mono text-muted-foreground">
                              EAN: {product.ean}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(product)}
                      </div>

                      {/* Informations principales */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Euro className="h-3 w-3" />
                            <span>Prix d'achat</span>
                          </div>
                          <p className="font-semibold text-sm">
                            {product.purchase_price} {product.currency}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            <span>Stock</span>
                          </div>
                          <p className="font-semibold text-sm">
                            {product.stock_quantity || "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {product.supplier_configurations?.supplier_name}
                        </span>
                        <div className="flex gap-1">
                          {product.supplier_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(product.supplier_url, "_blank");
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Alerte si pas d'EAN */}
                      {!product.ean && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 p-2 rounded">
                          <AlertCircle className="h-3 w-3" />
                          <span>Pas d'EAN - liaison manuelle requise</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
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
