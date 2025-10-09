import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface SupplierPriceHistoryProps {
  supplierProductId: string;
}

export function SupplierPriceHistory({ supplierProductId }: SupplierPriceHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["supplier-price-history", supplierProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_price_history")
        .select("*")
        .eq("supplier_product_id", supplierProductId)
        .order("changed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const getPriceChange = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const getPriceIcon = (change: number | null) => {
    if (change === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-red-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des prix</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground">Aucun historique disponible</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Variation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item, index) => {
                const previousPrice = history[index + 1]?.purchase_price;
                const change = previousPrice ? getPriceChange(item.purchase_price, previousPrice) : null;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {new Date(item.changed_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.purchase_price} {item.currency}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPriceIcon(change)}
                        {change !== null && (
                          <span className={`text-sm ${
                            change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-muted-foreground'
                          }`}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
