import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, TrendingDown, TrendingUp, Package, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SupplierCrossSearchProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierCrossSearch({ product, open, onOpenChange }: SupplierCrossSearchProps) {
  const [searchTerm, setSearchTerm] = useState(product?.product_name || "");
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const { data: similarProducts, isLoading, refetch } = useQuery({
    queryKey: ["similar-products", product?.id, searchTerm],
    queryFn: async () => {
      if (!product) return [];

      let query = `product_name.ilike.%${searchTerm}%`;
      if (product.ean) {
        query += `,ean.eq.${product.ean}`;
      }

      const { data, error } = await supabase
        .from("supplier_products")
        .select(`
          *,
          supplier_configurations!inner(supplier_name)
        `)
        .neq("supplier_id", product.supplier_id)
        .or(query)
        .order("purchase_price", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!product && open,
  });

  const handleLinkProduct = async (supplierProductId: string) => {
    setLinkingId(supplierProductId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // 1. Créer ou récupérer product_analyses pour le produit actuel
      let { data: analysis } = await supabase
        .from("product_analyses")
        .select("id")
        .eq("supplier_product_id", product.id)
        .maybeSingle();

      let analysisId = analysis?.id;

      if (!analysisId) {
        // Get user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // Create a minimal product_analyses entry
        const { data: newAnalysis, error: analysisError } = await supabase
          .from("product_analyses")
          .insert([{
            user_id: user.id,
            product_url: '',
            analysis_result: { 
              name: product.product_name,
              ean: product.ean,
              supplier_reference: product.supplier_reference
            }
          }])
          .select("id")
          .single();

        if (analysisError) {
          console.error("Error creating analysis:", analysisError);
          throw analysisError;
        }
        analysisId = newAnalysis.id;
      }

      // 2. Créer le product_link
      const { error: linkError } = await supabase.from("product_links").insert({
        analysis_id: analysisId,
        supplier_product_id: supplierProductId,
        link_type: "manual",
        confidence_score: 100,
        created_by: user.id,
      });

      if (linkError) throw linkError;

      toast.success("✅ Produit lié avec succès");
      refetch();
    } catch (error: any) {
      console.error("Link error:", error);
      toast.error(`❌ Erreur: ${error.message}`);
    } finally {
      setLinkingId(null);
    }
  };

  const calculatePriceDiff = (targetPrice: number) => {
    const diff = ((targetPrice - product.purchase_price) / product.purchase_price) * 100;
    return diff.toFixed(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche de Tarifs Similaires
          </DialogTitle>
          <DialogDescription>
            Recherchez des produits similaires chez d'autres fournisseurs pour "{product?.product_name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recherche personnalisée */}
          <div className="flex gap-2">
            <Input
              placeholder="Affiner la recherche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Résultats */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : similarProducts && similarProducts.length > 0 ? (
              similarProducts.map((similarProduct: any) => {
                const priceDiff = parseFloat(calculatePriceDiff(similarProduct.purchase_price));
                const isCheaper = priceDiff < 0;
                const isLinked = similarProduct.product_links?.length > 0;

                return (
                  <Card key={similarProduct.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-semibold">
                            {similarProduct.supplier_configurations?.supplier_name}
                          </Badge>
                          {isCheaper && (
                            <Badge className="bg-green-600 text-white">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Meilleur Prix
                            </Badge>
                          )}
                          {isLinked && (
                            <Badge variant="secondary">
                              <Link2 className="h-3 w-3 mr-1" />
                              Déjà lié
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{similarProduct.product_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              Réf: {similarProduct.supplier_reference}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Prix:</span>
                            <span className="font-semibold">{similarProduct.purchase_price} EUR</span>
                            <Badge
                              variant={isCheaper ? "default" : "secondary"}
                              className={isCheaper ? "bg-green-600" : ""}
                            >
                              {isCheaper ? (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              )}
                              {priceDiff > 0 ? "+" : ""}
                              {priceDiff}%
                            </Badge>
                          </div>

                          {similarProduct.stock_quantity && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Stock:</span>
                              <span className="font-medium">{similarProduct.stock_quantity}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLinkProduct(similarProduct.id)}
                        disabled={linkingId === similarProduct.id || isLinked}
                      >
                        {linkingId === similarProduct.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        {isLinked ? "Lié" : "Lier"}
                      </Button>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucun produit similaire trouvé chez les autres fournisseurs.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Essayez d'affiner votre recherche ou vérifiez que d'autres fournisseurs ont des produits importés.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
