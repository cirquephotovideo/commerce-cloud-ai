import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface PurchasePriceSectionProps {
  analysisId: string;
}

export const PurchasePriceSection = ({ analysisId }: PurchasePriceSectionProps) => {
  const { prices: suppliers, isLoading } = useSupplierPricesRealtime(analysisId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prix d'Achat par Fournisseur
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prix d'Achat par Fournisseur
          </CardTitle>
          <CardDescription>
            Aucun prix fournisseur disponible
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sortedSuppliers = [...suppliers].sort((a, b) => 
    a.purchase_price - b.purchase_price
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Prix d'Achat par Fournisseur
        </CardTitle>
        <CardDescription>
          {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} actif{suppliers.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedSuppliers.map((supplier, index) => (
            <div key={supplier.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div>
                  <div className="font-medium">{supplier.supplier_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {supplier.last_updated && formatDistanceToNow(new Date(supplier.last_updated), {
                      addSuffix: true,
                      locale: fr
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={index === 0 ? "default" : "outline"} className="text-base px-3 py-1">
                  {supplier.purchase_price}€
                </Badge>
                {supplier.stock_quantity && (
                  <Badge variant="outline" className="text-xs">
                    Stock: {supplier.stock_quantity}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
