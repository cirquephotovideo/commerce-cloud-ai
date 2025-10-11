import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSupplierPricesRealtime } from '@/hooks/useSupplierPricesRealtime';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LiveSupplierPriceCardProps {
  analysisId: string;
}

export const LiveSupplierPriceCard = ({ analysisId }: LiveSupplierPriceCardProps) => {
  const { prices, bestPrice, recentChanges, isLoading, refetch } = useSupplierPricesRealtime(analysisId);

  const getTrendIcon = (change?: number) => {
    if (!change) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
    return <TrendingDown className="h-4 w-4 text-green-600" />;
  };

  const getStockStatus = (stock: number | null) => {
    if (stock === null) return <Badge variant="outline">N/A</Badge>;
    if (stock > 100) return <Badge className="bg-green-600 text-white">✅ {stock}</Badge>;
    if (stock > 50) return <Badge variant="secondary">⚠️ {stock}</Badge>;
    return <Badge variant="destructive">🔴 {stock}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!bestPrice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Prix Fournisseurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucun prix fournisseur disponible pour ce produit
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            💰 Prix Fournisseurs
            <Badge variant="outline" className="animate-pulse">
              🔴 Live
            </Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Meilleur prix en évidence */}
        <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">🥇 Meilleur Prix</span>
            <Badge variant="secondary">{bestPrice.supplier_name}</Badge>
          </div>
          <div className="text-4xl font-bold text-primary">
            {bestPrice.purchase_price} {bestPrice.currency}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Stock:</span>
              {getStockStatus(bestPrice.stock_quantity)}
            </div>
            <div className="text-xs text-muted-foreground">
              MAJ: {new Date(bestPrice.last_updated).toLocaleString('fr-FR', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        </div>

        {/* Tableau comparatif */}
        {prices.length > 1 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Comparateur Multi-Fournisseurs</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">MAJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((price, index) => (
                    <TableRow key={price.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && <span className="text-lg">🥇</span>}
                          {index === 1 && <span className="text-lg">🥈</span>}
                          {index === 2 && <span className="text-lg">🥉</span>}
                          <span className="font-medium">{price.supplier_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{price.purchase_price} {price.currency}</span>
                          {index > 0 && (
                            <span className="text-xs text-muted-foreground">
                              (+{((price.purchase_price - bestPrice.purchase_price) / bestPrice.purchase_price * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStockStatus(price.stock_quantity)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(price.last_updated).toLocaleString('fr-FR', { 
                          day: '2-digit', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Changements récents */}
        {recentChanges.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">📊 Changements Récents</h4>
            <div className="space-y-2">
              {recentChanges.map((change, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(change.change_percentage)}
                    <span className="text-sm font-medium">{change.supplier_name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {change.old_price}€ → {change.new_price}€
                    </div>
                    <div className={`text-xs ${change.change_percentage > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {change.change_percentage > 0 ? '+' : ''}{change.change_percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
