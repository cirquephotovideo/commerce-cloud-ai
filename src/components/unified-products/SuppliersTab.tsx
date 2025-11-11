import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Link, Info, Boxes, Link as LinkIcon } from "lucide-react";
import { LinkProductDialog } from "./LinkProductDialog";

interface SuppliersTabProps {
  searchQuery: string;
}

export const SuppliersTab = ({ searchQuery }: SuppliersTabProps) => {
  const [page, setPage] = useState(1);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; ean?: string } | null>(null);
  const itemsPerPage = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers-tab", searchQuery, page],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("supplier_products")
        .select(`
          *,
          supplier_configurations(supplier_name),
          product_links(
            id,
            link_type,
            confidence_score,
            analysis_id,
            product_analyses(
              analysis_result
            )
          )
        `, { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (searchQuery && searchQuery.length >= 2) {
        const searchPattern = `%${searchQuery}%`;
        query = query.or(`product_name.ilike.${searchPattern},ean.ilike.${searchPattern}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { products: data || [], count: count || 0 };
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data?.products || data.products.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Boxes className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {searchQuery ? "Aucun produit fournisseur trouvé" : "Aucun produit fournisseur"}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? `Aucun résultat pour "${searchQuery}"`
              : "Connectez un fournisseur pour synchroniser vos produits"}
          </p>
        </div>
      </Card>
    );
  }

  const unlinkedCount = data?.products.filter((p) => !p.product_links || p.product_links.length === 0).length || 0;
  const totalPages = Math.ceil((data?.count || 0) / itemsPerPage);

  const handleOpenLinkDialog = (productId: string, productName: string, ean?: string) => {
    setSelectedProduct({ id: productId, name: productName, ean });
    setLinkDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Alert pour produits non liés */}
      {unlinkedCount > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>💡 Produits Non Liés Détectés</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {unlinkedCount} produit(s) fournisseur sans lien vers une analyse.
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom Produit</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead>Prix d'Achat</TableHead>
              <TableHead>Lié à</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.products.map((sp) => {
              const link = sp.product_links?.[0];
              return (
                <TableRow key={sp.id}>
                  <TableCell className="font-medium">{sp.product_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {sp.supplier_configurations?.supplier_name || "Inconnu"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sp.ean ? (
                      <Badge variant="outline">{sp.ean}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sp.purchase_price ? (
                      <span className="font-mono">
                        {sp.purchase_price.toFixed(2)} {sp.currency || "EUR"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {link ? (
                      <div className="space-y-1">
                        <Badge variant="default" className="gap-1">
                          <Link className="h-3 w-3" />
                          {link.link_type === "auto" ? "Auto" : link.link_type === "manual" ? "Manuel" : "Suggestion"}
                        </Badge>
                        {(link.product_analyses?.analysis_result as any)?.name && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {(link.product_analyses.analysis_result as any).name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary">❌ Non lié</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {link ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/product/${link.analysis_id}`, "_blank")}
                      >
                        Voir Analyse
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenLinkDialog(sp.id, sp.product_name, sp.ean || undefined)}
                        className="gap-1"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Lier
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} ({data?.count} produits)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de liaison */}
      {selectedProduct && (
        <LinkProductDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          productEan={selectedProduct.ean}
          productType="supplier"
        />
      )}
    </div>
  );
};
