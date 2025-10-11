import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Mail, ExternalLink, TrendingUp } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SuppliersSectionProps {
  analysisId: string;
}

export const SuppliersSection = ({ analysisId }: SuppliersSectionProps) => {
  const { prices: suppliers, isLoading, refetch } = useSupplierPricesRealtime(analysisId);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`suppliers-${analysisId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'supplier_price_variants',
        filter: `analysis_id=eq.${analysisId}`
      }, () => {
        refetch();
        toast.success('Prix fournisseur mis à jour');
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId, refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fournisseurs Liés
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
            <Truck className="h-5 w-5" />
            Fournisseurs Liés
          </CardTitle>
          <CardDescription>
            Aucun fournisseur lié à ce produit
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Fournisseurs Liés ({suppliers.length})
        </CardTitle>
        <CardDescription>
          Informations détaillées sur les fournisseurs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-lg">{supplier.supplier_name}</div>
                </div>
                <Badge variant="default" className="text-base px-3 py-1">
                  {supplier.purchase_price}€
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock:</span>
                  <span className="font-medium">
                    {supplier.stock_quantity ? (
                      <Badge variant="outline" className="gap-1">
                        ✅ {supplier.stock_quantity} unités
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        ⚠️ Non spécifié
                      </Badge>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernière MAJ:</span>
                  <span className="font-medium">
                    {supplier.last_updated && formatDistanceToNow(new Date(supplier.last_updated), {
                      addSuffix: true,
                      locale: fr
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-2">
                  <Mail className="h-3 w-3" />
                  Contacter
                </Button>
                <Button size="sm" variant="outline" className="gap-2">
                  <TrendingUp className="h-3 w-3" />
                  Historique
                </Button>
                <Button size="sm" variant="outline" className="gap-2">
                  <ExternalLink className="h-3 w-3" />
                  Catalogue
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
