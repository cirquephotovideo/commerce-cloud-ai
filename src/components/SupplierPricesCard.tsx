import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/formatters";

interface SupplierPricesCardProps {
  productAnalysisId: string;
}

export function SupplierPricesCard({ productAnalysisId }: SupplierPricesCardProps) {
  const { data: priceVariants, isLoading } = useQuery({
    queryKey: ['supplier-price-variants', productAnalysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_price_variants')
        .select(`
          *,
          supplier_configurations(supplier_name)
        `)
        .eq('analysis_id', productAnalysisId)
        .order('purchase_price', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const getMatchBadge = (matchType: string, confidence: number) => {
    const configs: Record<string, { variant: any; label: string; }> = {
      exact_ean: { variant: "default", label: `EAN ${Math.round(confidence)}%` },
      supplier_ref: { variant: "secondary", label: `Réf ${Math.round(confidence)}%` },
      name_similarity: { variant: "outline", label: `Nom ${Math.round(confidence)}%` },
    };
    const config = configs[matchType] || configs.name_similarity;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const getPriceHistory = (priceHistory: any) => {
    if (!priceHistory || !Array.isArray(priceHistory) || priceHistory.length === 0) {
      return null;
    }
    
    const lastChange = priceHistory[priceHistory.length - 1];
    const variationPct = lastChange.variation_pct;
    
    return (
      <div className="flex items-center gap-1 text-xs">
        {variationPct > 0 ? (
          <TrendingUp className="h-3 w-3 text-destructive" />
        ) : (
          <TrendingDown className="h-3 w-3 text-green-500" />
        )}
        <span className={variationPct > 0 ? "text-destructive" : "text-green-500"}>
          {variationPct > 0 ? '+' : ''}{variationPct}%
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!priceVariants || priceVariants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prix fournisseurs</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Aucun prix fournisseur disponible pour ce produit
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Prix fournisseurs ({priceVariants.length})</span>
          <Badge variant="outline">
            Meilleur prix: {formatPrice(priceVariants[0]?.purchase_price)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Prix achat</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Matching</TableHead>
              <TableHead>Évolution</TableHead>
              <TableHead>Dernière MAJ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceVariants.map((variant: any) => (
              <TableRow key={variant.id}>
                <TableCell className="font-medium">
                  {variant.supplier_configurations?.supplier_name || 'Inconnu'}
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {variant.supplier_reference || 'N/A'}
                  </code>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatPrice(variant.purchase_price)}
                </TableCell>
                <TableCell>
                  <Badge variant={variant.stock_quantity > 0 ? "default" : "secondary"}>
                    {variant.stock_quantity || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getMatchBadge(variant.match_type, variant.match_confidence)}
                </TableCell>
                <TableCell>
                  {getPriceHistory(variant.price_history)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(variant.updated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
