import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Mail, ExternalLink, TrendingUp, Link as LinkIcon, Loader2, AlertCircle } from "lucide-react";
import { useSupplierPricesRealtime } from "@/hooks/useSupplierPricesRealtime";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

interface SuppliersSectionProps {
  analysisId: string;
}

export const SuppliersSection = ({ analysisId }: SuppliersSectionProps) => {
  const { prices: suppliers, isLoading, refetch } = useSupplierPricesRealtime(analysisId);
  const [isLinking, setIsLinking] = useState(false);

  // Get the product's EAN to check if auto-linking is possible
  const { data: productData } = useQuery({
    queryKey: ['product-ean', analysisId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_analyses')
        .select('ean')
        .eq('id', analysisId)
        .single();
      return data;
    }
  });

  const handleAutoLink = async () => {
    setIsLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-single-product-suppliers', {
        body: { analysisId }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.links_created} fournisseur(s) lié(s) automatiquement`);
        refetch();
      } else {
        toast.error(data?.error || 'Aucun fournisseur trouvé');
      }
    } catch (error: any) {
      console.error('Error auto-linking:', error);
      toast.error('Erreur lors de la liaison automatique');
    } finally {
      setIsLinking(false);
    }
  };

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
    const hasEan = productData?.ean && productData.ean !== '';
    
    return (
      <Card id="section-suppliers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fournisseurs Liés
          </CardTitle>
          <CardDescription>
            Aucun fournisseur lié à ce produit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasEan ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Ce produit n'a pas d'EAN</strong>
                <p className="text-sm mt-2">
                  Pour lier automatiquement des fournisseurs, ce produit doit avoir un code EAN valide.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <LinkIcon className="h-4 w-4" />
              <AlertDescription>
                <strong>Liaison automatique disponible</strong>
                <p className="text-sm mt-2 mb-3">
                  Ce produit a un EAN ({productData.ean}). Cliquez ci-dessous pour rechercher et lier automatiquement les fournisseurs correspondants.
                </p>
                <Button 
                  onClick={handleAutoLink}
                  disabled={isLinking}
                  size="sm"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Lier automatiquement par EAN
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">💡 Comment lier des fournisseurs :</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Utilisez la <strong>Fusion Multi-Fournisseurs</strong> pour lier automatiquement tous vos produits par EAN</li>
              <li>Ou cliquez sur "Lier automatiquement par EAN" ci-dessus pour ce produit uniquement</li>
              <li>Les fournisseurs doivent avoir le même EAN que ce produit pour être liés</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="section-suppliers">
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
