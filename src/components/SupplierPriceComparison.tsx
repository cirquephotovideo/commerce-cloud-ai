import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, TrendingDown, Package, Calendar } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          Comparaison des Fournisseurs
        </CardTitle>
        <CardDescription>
          {prices.length} fournisseur{prices.length > 1 ? 's' : ''} trouvé{prices.length > 1 ? 's' : ''} pour ce produit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Prix</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-center">Disponible</TableHead>
              <TableHead className="text-right">Dernière synchro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => {
              const isBestPrice = bestPrice?.id === price.id;
              const isOutOfStock = !price.stock_quantity || price.stock_quantity === 0;
              
              return (
                <TableRow key={price.id} className={isBestPrice ? "bg-accent/50" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {price.supplier_name || 'Fournisseur inconnu'}
                      {isBestPrice && (
                        <Badge variant="default" className="gap-1">
                          <TrendingDown className="w-3 h-3" />
                          Meilleur prix
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {price.supplier_reference || '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {price.purchase_price ? `${price.purchase_price.toFixed(2)}€` : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {price.stock_quantity || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {isOutOfStock ? (
                      <Badge variant="destructive">Rupture</Badge>
                    ) : price.stock_quantity && price.stock_quantity < 10 ? (
                      <Badge variant="secondary">Stock faible</Badge>
                    ) : (
                      <Badge variant="default">En stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      {price.last_updated 
                        ? format(new Date(price.last_updated), 'dd/MM/yyyy', { locale: fr })
                        : 'Jamais'}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Statistiques résumées */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Prix moyen</p>
            <p className="text-lg font-semibold">
              {(prices.reduce((sum, p) => sum + (p.purchase_price || 0), 0) / prices.length).toFixed(2)}€
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Stock total</p>
            <p className="text-lg font-semibold">
              {prices.reduce((sum, p) => sum + (p.stock_quantity || 0), 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Meilleur prix</p>
            <p className="text-lg font-semibold text-primary">
              {bestPrice ? `${bestPrice.purchase_price?.toFixed(2)}€` : 'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
