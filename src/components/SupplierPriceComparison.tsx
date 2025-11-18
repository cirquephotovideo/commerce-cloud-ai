import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, TrendingDown, Package, Calendar, Copy, AlertCircle } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SupplierPriceComparisonProps {
  analysisId: string;
}

export const SupplierPriceComparison = ({ analysisId }: SupplierPriceComparisonProps) => {
  const { prices, bestPrice, isLoading } = useSupplierPricesRealtime(analysisId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Comparaison Fournisseurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prices || prices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Comparaison Fournisseurs
          </CardTitle>
          <CardDescription>
            Aucun fournisseur trouvé pour ce produit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun produit fournisseur lié</p>
            <p className="text-sm mt-2">Liez des produits fournisseurs pour voir la comparaison</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgPrice = prices.reduce((sum, p) => sum + (p.purchase_price || 0), 0) / prices.length;
  const totalStock = prices.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
  const maxSavings = bestPrice && prices.length > 1 ? avgPrice - bestPrice.purchase_price! : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          Comparaison des Fournisseurs ({prices.length})
        </CardTitle>
        <CardDescription>
          Meilleur prix: {bestPrice?.purchase_price?.toFixed(2)}€ • Stock total: {totalStock} unités
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Prix</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-center">Disponible</TableHead>
              <TableHead className="text-right">Dernière synchro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => {
              const isBestPrice = bestPrice?.id === price.id;
              const isOutOfStock = !price.stock_quantity || price.stock_quantity === 0;
              const priceVariation = bestPrice && price.purchase_price
                ? ((price.purchase_price - bestPrice.purchase_price!) / bestPrice.purchase_price! * 100)
                : 0;
              
              return (
                <TableRow 
                  key={price.id} 
                  className={cn(
                    isBestPrice ? "bg-green-50 dark:bg-green-900/20" : "",
                    isOutOfStock ? "opacity-50" : ""
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {price.supplier_name || 'Fournisseur inconnu'}
                      </span>
                      {isBestPrice && (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <TrendingDown className="w-3 h-3" />
                          Meilleur prix
                        </Badge>
                      )}
                      {priceVariation > 10 && !isBestPrice && (
                        <Badge variant="destructive">
                          +{priceVariation.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-mono text-xs h-7 px-2"
                      onClick={() => {
                        navigator.clipboard.writeText(price.supplier_reference || '');
                        toast.success('Code copié');
                      }}
                    >
                      {price.supplier_reference || '-'}
                      <Copy className="w-3 h-3 ml-1 opacity-50" />
                    </Button>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "font-semibold text-lg",
                        isBestPrice ? "text-green-600 dark:text-green-400" : ""
                      )}>
                        {price.purchase_price?.toFixed(2)}€
                      </span>
                      {priceVariation > 0 && !isBestPrice && (
                        <span className="text-xs text-red-500">
                          +{priceVariation.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isOutOfStock ? "bg-red-500" : 
                        price.stock_quantity && price.stock_quantity < 10 ? "bg-orange-500" :
                        "bg-green-500"
                      )} />
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{price.stock_quantity || 0}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {isOutOfStock ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Rupture
                      </Badge>
                    ) : price.stock_quantity && price.stock_quantity < 10 ? (
                      <Badge variant="secondary" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Stock faible
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        ✓ En stock
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      {price.last_updated 
                        ? format(new Date(price.last_updated), 'dd/MM/yyyy', { locale: fr })
                        : '-'}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => {
                        const info = `${price.supplier_name}\nRéf: ${price.supplier_reference}\nPrix: ${price.purchase_price}€\nStock: ${price.stock_quantity}`;
                        navigator.clipboard.writeText(info);
                        toast.success('Infos copiées');
                      }}
                    >
                      📋
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Statistiques résumées */}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Prix moyen</p>
            <p className="text-lg font-semibold">
              {avgPrice.toFixed(2)}€
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Stock total</p>
            <p className="text-lg font-semibold text-blue-600">
              {totalStock} unités
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Meilleur prix</p>
            <p className="text-lg font-semibold text-green-600">
              {bestPrice ? `${bestPrice.purchase_price?.toFixed(2)}€` : 'N/A'}
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Économies potentielles</p>
            <p className="text-lg font-semibold text-orange-600">
              {maxSavings > 0 ? `${maxSavings.toFixed(2)}€` : 'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
