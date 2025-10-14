import { ProductExportMenu } from "@/components/ProductExportMenu";
import { SupplierPriceComparison } from "@/components/SupplierPriceComparison";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp } from "lucide-react";

interface ProductExportTabProps {
  analysisId: string;
  productName: string;
}

export const ProductExportTab = ({ analysisId, productName }: ProductExportTabProps) => {
  return (
    <div className="space-y-6">
      {/* Supplier Price Comparison */}
      <SupplierPriceComparison analysisId={analysisId} />

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Export vers Plateformes
          </CardTitle>
          <CardDescription>
            Exportez ce produit vers vos plateformes de vente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Sélectionnez une plateforme de destination pour exporter <strong>{productName}</strong>
            </div>
            
            <ProductExportMenu analysisId={analysisId} productName={productName} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des Exports</CardTitle>
          <CardDescription>
            Suivez l'état de vos exports précédents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun export pour ce produit</p>
            <p className="text-sm mt-2">Les exports apparaîtront ici une fois effectués</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
