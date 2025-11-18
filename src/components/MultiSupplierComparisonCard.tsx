import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Store, TrendingDown, Package, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  reference: string;
  price: number;
  stock: number;
  lastUpdate: Date;
}

interface Props {
  suppliers: Supplier[];
  compact?: boolean;
}

export const MultiSupplierComparisonCard = ({ suppliers, compact = false }: Props) => {
  const [sortBy, setSortBy] = useState<'price' | 'stock' | 'name'>('price');
  
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    switch (sortBy) {
      case 'price': return a.price - b.price;
      case 'stock': return b.stock - a.stock;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });
  
  const bestPrice = Math.min(...suppliers.map(s => s.price));
  const totalStock = suppliers.reduce((sum, s) => sum + s.stock, 0);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              {suppliers.length} Fournisseurs Disponibles
            </CardTitle>
            <CardDescription>
              Meilleur prix: {bestPrice.toFixed(2)}€ • Stock total: {totalStock}
            </CardDescription>
          </div>
          
          {!compact && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={sortBy === 'price' ? 'default' : 'outline'}
                onClick={() => setSortBy('price')}
              >
                Prix
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'stock' ? 'default' : 'outline'}
                onClick={() => setSortBy('stock')}
              >
                Stock
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'name' ? 'default' : 'outline'}
                onClick={() => setSortBy('name')}
              >
                Nom
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          {sortedSuppliers.map((supplier) => {
            const isBest = supplier.price === bestPrice;
            const priceVariation = ((supplier.price - bestPrice) / bestPrice) * 100;
            
            return (
              <div
                key={supplier.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  isBest ? "bg-green-50 dark:bg-green-900/20 border-green-500" : "hover:bg-accent"
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{supplier.name}</span>
                    {isBest && (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <TrendingDown className="w-3 h-3" />
                        Meilleur
                      </Badge>
                    )}
                    {priceVariation > 10 && !isBest && (
                      <Badge variant="destructive">+{priceVariation.toFixed(0)}%</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground font-mono">
                      Réf: {supplier.reference}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(supplier.reference);
                        toast.success('Référence copiée');
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      isBest ? "text-green-600" : ""
                    )}>
                      {supplier.price.toFixed(2)}€
                    </p>
                    {priceVariation > 0 && !isBest && (
                      <p className="text-xs text-red-500">
                        +{priceVariation.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{supplier.stock}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};