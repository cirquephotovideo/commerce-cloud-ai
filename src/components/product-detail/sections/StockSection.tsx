import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingDown, AlertCircle } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";

interface StockSectionProps {
  analysisId: string;
}

export const StockSection = ({ analysisId }: StockSectionProps) => {
  const { prices: suppliers, isLoading } = useSupplierPricesRealtime(analysisId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Gestion du Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  const totalStock = suppliers?.reduce((sum, s) => sum + (s.stock_quantity || 0), 0) || 0;
  const lowStockSuppliers = suppliers?.filter(s => (s.stock_quantity || 0) < 50) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Gestion du Stock
        </CardTitle>
        <CardDescription>
          Vue consolidée des stocks fournisseurs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock total */}
        <div className="p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stock total</span>
            <Badge variant="default" className="text-lg px-4 py-1">
              {totalStock} unités
            </Badge>
          </div>
        </div>

        {/* Détail par fournisseur */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Par fournisseur</div>
          {suppliers?.map((supplier) => {
            const stock = supplier.stock_quantity || 0;
            const isLowStock = stock < 50;

            return (
              <div key={supplier.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{supplier.supplier_name}</span>
                  {isLowStock && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      Stock faible
                    </Badge>
                  )}
                </div>
                <Badge variant={isLowStock ? 'destructive' : 'default'} className="px-3">
                  {stock} unités {isLowStock ? '⚠️' : '✅'}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Alertes */}
        {lowStockSuppliers.length > 0 && (
          <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-destructive">
                  Alerte réapprovisionnement
                </div>
                <div className="text-sm text-muted-foreground">
                  {lowStockSuppliers.length} fournisseur{lowStockSuppliers.length > 1 ? 's' : ''} avec stock faible
                </div>
              </div>
            </div>
          </div>
        )}

        <Button size="sm" variant="outline" className="w-full gap-2">
          <TrendingDown className="h-3 w-3" />
          Définir des alertes de stock
        </Button>
      </CardContent>
    </Card>
  );
};
