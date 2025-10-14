import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store } from "lucide-react";

interface SupplierPriceComparisonProps {
  analysisId: string;
}

export const SupplierPriceComparison = ({ analysisId }: SupplierPriceComparisonProps) => {
  // Simplified for Phase 3 - will be fully implemented in Phase 4
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5" />
          Comparaison Fournisseurs
        </CardTitle>
        <CardDescription>
          Comparaison multi-fournisseurs (à venir)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Fonctionnalité en cours de développement</p>
          <p className="text-sm mt-2">La comparaison de prix entre fournisseurs sera disponible dans Phase 4</p>
          <Badge variant="secondary" className="mt-4">Prochainement</Badge>
        </div>
      </CardContent>
    </Card>
  );
};
