import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, TrendingUp, TrendingDown } from "lucide-react";

interface UnifiedProduct {
  analysis_id: string;
  product_name: string;
  ean: string;
  brand: string;
  supplier_count: number;
  min_price: number;
  max_price: number;
  total_stock: number;
  best_margin: number;
}

export const UnifiedDashboardCard = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ['unified-products-dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase.rpc('get_unified_products', {
        p_user_id: user.id,
        p_search_query: null,
        p_limit: 10,
        p_offset: 0
      });
      
      if (error) throw error;
      
      // Parse the JSONB response
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return (Array.isArray(parsed) ? parsed : []) as UnifiedProduct[];
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            📊 Vue Unifiée - Produits & Fournisseurs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            📊 Vue Unifiée - Produits & Fournisseurs
          </CardTitle>
          <CardDescription>
            Aperçu rapide de vos produits avec leurs fournisseurs et prix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucun produit lié à des fournisseurs pour le moment</p>
            <p className="text-xs mt-1">Importez des produits fournisseurs pour voir les données ici</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          📊 Vue Unifiée - Top 10 Produits
        </CardTitle>
        <CardDescription>
          Produits avec plusieurs fournisseurs et leurs variations de prix
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Produit</TableHead>
                <TableHead className="text-center">EAN</TableHead>
                <TableHead className="text-center">Fournisseurs</TableHead>
                <TableHead className="text-right">Prix Min</TableHead>
                <TableHead className="text-right">Prix Max</TableHead>
                <TableHead className="text-center">Écart</TableHead>
                <TableHead className="text-right">Stock Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const priceGap = product.max_price - product.min_price;
                const priceGapPercent = product.min_price > 0 
                  ? ((priceGap / product.min_price) * 100).toFixed(1)
                  : 0;
                
                return (
                  <TableRow key={product.analysis_id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{product.product_name}</span>
                        {product.brand && (
                          <span className="text-xs text-muted-foreground">{product.brand}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {product.ean || '-'}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-bold">
                        {product.supplier_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                      {product.min_price ? `${product.min_price.toFixed(2)}€` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-600 dark:text-orange-400">
                      {product.max_price ? `${product.max_price.toFixed(2)}€` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {priceGap > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            {priceGapPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {product.total_stock || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
