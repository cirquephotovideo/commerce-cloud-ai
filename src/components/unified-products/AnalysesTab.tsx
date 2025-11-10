import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ProductLinksCell } from "./ProductLinksCell";
import { Link, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AnalysesTabProps {
  searchQuery: string;
}

export const AnalysesTab = ({ searchQuery }: AnalysesTabProps) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["analyses-tab", searchQuery, page],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("product_analyses")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (searchQuery && searchQuery.length >= 2) {
        const searchPattern = `%${searchQuery}%`;
        query = query.or(`analysis_result->>name.ilike.${searchPattern},ean.ilike.${searchPattern}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { products: data || [], count: count || 0 };
    },
  });

  const autoLinkMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("auto-link-products", {
        body: {
          user_id: user.id,
          analysis_id: productId,
          auto_mode: true,
          min_confidence: 95,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ${data.links_created || 0} lien(s) créé(s)`);
      queryClient.invalidateQueries({ queryKey: ["product-links"] });
      queryClient.invalidateQueries({ queryKey: ["analyses-tab"] });
    },
    onError: () => {
      toast.error("Erreur lors de l'auto-link");
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

  const totalPages = Math.ceil((data?.count || 0) / itemsPerPage);

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Liens Fournisseurs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {(product.analysis_result as any)?.image_url && (
                      <img
                        src={(product.analysis_result as any).image_url}
                        alt={(product.analysis_result as any)?.name || "Product"}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <span className="font-medium">
                      {(product.analysis_result as any)?.name || "Sans nom"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {product.ean ? (
                    <Badge variant="outline">{product.ean}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {product.category ? (
                    <Badge variant="secondary">{product.category}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ProductLinksCell analysisId={product.id} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => autoLinkMutation.mutate(product.id)}
                      disabled={autoLinkMutation.isPending}
                    >
                      {autoLinkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Link className="h-4 w-4 mr-1" />
                          Auto-Link
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
};
