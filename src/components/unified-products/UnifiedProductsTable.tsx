import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  supplier_id: string;
  supplier_name: string;
  supplier_reference: string;
  purchase_price: number;
  stock_quantity: number;
  last_updated: string;
}

interface UnifiedProduct {
  analysis_id: string;
  ean: string;
  product_name: string;
  brand: string;
  primary_image: string;
  supplier_count: number;
  best_price: number;
  worst_price: number;
  avg_price: number;
  total_stock: number;
  selling_price: number;
  margin_percentage: number;
  suppliers: Supplier[];
  enrichment_status: any;
  potential_savings: number;
}

interface Props {
  searchQuery?: string;
}

export const UnifiedProductsTable = ({ searchQuery }: Props) => {
  const [page, setPage] = useState(0);
  const itemsPerPage = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['unified-products', searchQuery, page],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('get_unified_products' as any, {
        p_user_id: user.id,
        p_search_query: searchQuery || null,
        p_limit: itemsPerPage,
        p_offset: page * itemsPerPage
      });

      if (error) throw error;
      
      // Parse the JSONB result
      const products = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(products) ? products as UnifiedProduct[] : [];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Vue Unifiée - Produits Multi-Fournisseurs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Nom du Produit</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead className="text-center">Fournisseurs</TableHead>
              <TableHead className="text-right">Meilleur Prix</TableHead>
              <TableHead className="text-right">Stock Total</TableHead>
              <TableHead className="text-right">Économies</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((product) => (
              <TableRow key={product.analysis_id}>
                {/* Image */}
                <TableCell>
                  {product.primary_image ? (
                    <img 
                      src={product.primary_image} 
                      alt={product.product_name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>

                {/* Nom + Marque */}
                <TableCell>
                  <div>
                    <p className="font-semibold">{product.product_name}</p>
                    {product.brand && (
                      <p className="text-sm text-muted-foreground">{product.brand}</p>
                    )}
                  </div>
                </TableCell>

                {/* EAN */}
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {product.ean || '-'}
                  </code>
                </TableCell>

                {/* Fournisseurs avec détails */}
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="secondary">
                      {product.supplier_count} fournisseur{product.supplier_count > 1 ? 's' : ''}
                    </Badge>
                    
                    {/* Liste des fournisseurs */}
                    <div className="text-xs space-y-1 mt-2">
                      {product.suppliers?.slice(0, 3).map((supplier: Supplier, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-2 p-1 bg-muted rounded">
                          <span className="font-medium truncate">{supplier.supplier_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">
                              {supplier.purchase_price?.toFixed(2)}€
                            </span>
                            <span className="text-muted-foreground">
                              Stock: {supplier.stock_quantity || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                      {product.suppliers?.length > 3 && (
                        <p className="text-muted-foreground">
                          + {product.suppliers.length - 3} autre(s)
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Meilleur Prix */}
                <TableCell className="text-right">
                  {product.best_price ? (
                    <div>
                      <p className="text-lg font-bold text-primary">
                        {product.best_price.toFixed(2)}€
                      </p>
                      {product.supplier_count > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Moy: {product.avg_price?.toFixed(2)}€
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>

                {/* Stock Total */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      product.total_stock === 0 ? "bg-destructive" :
                      product.total_stock < 20 ? "bg-orange-500" :
                      "bg-primary"
                    )} />
                    <span className="font-semibold">{product.total_stock || 0}</span>
                  </div>
                </TableCell>

                {/* Économies Potentielles */}
                <TableCell className="text-right">
                  {product.potential_savings > 0 ? (
                    <div className="flex items-center justify-end gap-1">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      <span className="font-bold text-orange-600">
                        {product.potential_savings.toFixed(2)}€
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Précédent
          </Button>
          <span className="py-2 px-4">Page {page + 1}</span>
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={!data || data.length < itemsPerPage}
          >
            Suivant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
