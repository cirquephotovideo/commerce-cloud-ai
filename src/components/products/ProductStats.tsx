import { Card, CardContent } from "@/components/ui/card";
import { Package, Zap, AlertTriangle, DollarSign } from "lucide-react";

interface ProductStatsProps {
  products: any[];
  totalProducts: number;
}

export function ProductStats({ products, totalProducts }: ProductStatsProps) {
  const enrichedCount = products.filter(p => p.amazon_enrichment_status !== null).length;
  const missingCount = products.filter(p => p.amazon_enrichment_status === null).length;
  
  const totalValue = products.reduce((sum, p) => {
    const supplierProducts = Array.isArray(p.supplier_products) 
      ? p.supplier_products 
      : p.supplier_products 
        ? [p.supplier_products] 
        : [];
    const price = supplierProducts[0]?.purchase_price || p.purchase_price || 0;
    return sum + price;
  }, 0);

  const enrichedPercentage = totalProducts > 0 
    ? Math.round((enrichedCount / totalProducts) * 100)
    : 0;

  const missingPercentage = totalProducts > 0
    ? Math.round((missingCount / totalProducts) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">produits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enrichis</p>
              <p className="text-2xl font-bold">{enrichedCount}</p>
              <p className="text-xs text-muted-foreground">
                {enrichedPercentage}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manquants</p>
              <p className="text-2xl font-bold">{missingCount}</p>
              <p className="text-xs text-muted-foreground">
                {missingPercentage}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Val. Totale</p>
              <p className="text-2xl font-bold">{totalValue.toFixed(0)}€</p>
              <p className="text-xs text-muted-foreground">
                d'achats
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
