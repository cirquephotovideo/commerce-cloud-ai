import { useSupplierPricesRealtime } from '@/hooks/useSupplierPricesRealtime';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, AlertTriangle, XCircle } from 'lucide-react';

interface SupplierPricesTableProps {
  analysisId: string;
  compact?: boolean;
}

export const SupplierPricesTable = ({ analysisId, compact = false }: SupplierPricesTableProps) => {
  const { prices, bestPrice, isLoading } = useSupplierPricesRealtime(analysisId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucun prix fournisseur disponible</p>
      </div>
    );
  }

  const displayPrices = compact ? prices.slice(0, 3) : prices;
  const totalStock = prices.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Prix</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayPrices.map((price) => (
              <TableRow key={price.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {price.supplier_name}
                    {price.id === bestPrice?.id && (
                      <Badge variant="default" className="text-xs">
                        <Trophy className="h-3 w-3 mr-1" />
                        Meilleur Prix
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {price.purchase_price.toFixed(2)} {price.currency}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>{price.stock_quantity || 0}</span>
                    {price.stock_quantity === 0 && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {price.stock_quantity && price.stock_quantity < 50 && price.stock_quantity > 0 && (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!compact && (
        <div className="flex gap-4 text-sm">
          <div className="flex-1">
            <span className="text-muted-foreground">Prix moyen: </span>
            <span className="font-semibold">
              {(prices.reduce((sum, p) => sum + p.purchase_price, 0) / prices.length).toFixed(2)} €
            </span>
          </div>
          <div className="flex-1">
            <span className="text-muted-foreground">Stock total: </span>
            <span className="font-semibold">{totalStock} unités</span>
          </div>
          <div className="flex-1">
            <span className="text-muted-foreground">Fournisseurs: </span>
            <span className="font-semibold">{prices.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
