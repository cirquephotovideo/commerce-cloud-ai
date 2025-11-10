import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

interface Code2AsinTabProps {
  searchQuery: string;
}

export const Code2AsinTab = ({ searchQuery }: Code2AsinTabProps) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["code2asin-tab", searchQuery, page],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("code2asin_enrichments")
        .select(`
          *,
          product_analyses(
            id,
            analysis_result,
            supplier_products(
              purchase_price,
              currency
            )
          )
        `, { count: "exact" })
        .eq("user_id", user.id)
        .order("enriched_at", { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (searchQuery && searchQuery.length >= 2) {
        const searchPattern = `%${searchQuery}%`;
        query = query.or(`title.ilike.${searchPattern},asin.ilike.${searchPattern},ean.ilike.${searchPattern}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { enrichments: data || [], count: count || 0 };
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
              <TableHead>ASIN</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead>Prix Amazon</TableHead>
              <TableHead>Prix d'Achat</TableHead>
              <TableHead>Marge Potentielle</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.enrichments.map((enrich) => {
              const purchasePrice =
                enrich.product_analyses?.supplier_products?.[0]?.purchase_price || 0;
              const amazonPrice = enrich.buybox_price || enrich.amazon_price || 0;
              const margin = amazonPrice - purchasePrice;
              const marginPercent = amazonPrice > 0 ? (margin / amazonPrice) * 100 : 0;

              return (
                <TableRow key={enrich.id}>
                <TableCell>
                    <div className="flex items-center gap-2">
                      {(enrich as any).main_image && (
                        <img
                          src={(enrich as any).main_image}
                          alt={enrich.title || "Product"}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="font-medium line-clamp-2 max-w-[300px]">
                        {enrich.title || "Sans titre"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://amazon.fr/dp/${enrich.asin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      {enrich.asin}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    {enrich.ean ? (
                      <Badge variant="outline">{enrich.ean}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {amazonPrice > 0 ? (
                      <span className="font-mono">{amazonPrice.toFixed(2)} €</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {purchasePrice > 0 ? (
                      <span className="font-mono">{purchasePrice.toFixed(2)} €</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {amazonPrice > 0 && purchasePrice > 0 ? (
                      <div className="space-y-1">
                        <Badge
                          variant={
                            marginPercent > 30
                              ? "default"
                              : marginPercent > 15
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {margin.toFixed(2)} € ({marginPercent.toFixed(1)}%)
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {enrich.product_analyses?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`/product/${enrich.product_analyses.id}`, "_blank")
                        }
                      >
                        Voir Analyse
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
            Page {page} sur {totalPages} ({data?.count} enrichissements)
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
