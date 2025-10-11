import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/formatters";
import { Truck, Link as LinkIcon, Sparkles } from "lucide-react";

interface SupplierLinkedTabProps {
  analysisId: string;
}

export function SupplierLinkedTab({ analysisId }: SupplierLinkedTabProps) {
  const { data: linkedSuppliers, isLoading } = useQuery({
    queryKey: ['linked-suppliers', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          id,
          name,
          ean,
          supplier_reference,
          purchase_price,
          stock_quantity,
          supplier_configurations!inner(supplier_name),
          product_links!inner(link_type, confidence_score, analysis_id)
        `)
        .eq('product_links.analysis_id', analysisId);

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (!linkedSuppliers || linkedSuppliers.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun fournisseur lié à ce produit</p>
          <p className="text-sm mt-2">
            Les produits fournisseurs peuvent être liés automatiquement lors de l'import
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Fournisseurs associés à ce produit ({linkedSuppliers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linkedSuppliers.map((sp: any) => {
          const link = sp.product_links?.[0];
          const supplier = sp.supplier_configurations;
          
          return (
            <div key={sp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{supplier?.supplier_name || 'N/A'}</p>
                  <Badge 
                    variant={link?.link_type === 'automatic' || link?.link_type === 'exact_ean' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {link?.link_type === 'exact_ean' ? (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        EAN Exact
                      </>
                    ) : link?.link_type === 'automatic' ? (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Auto IA
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-3 h-3 mr-1" />
                        Manuel
                      </>
                    )}
                  </Badge>
                  {link?.confidence_score && (
                    <Badge variant="outline" className="text-xs">
                      {link.confidence_score}%
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Réf: <code className="text-xs bg-muted px-1 py-0.5 rounded">{sp.supplier_reference || 'N/A'}</code>
                  {' • '}
                  EAN: {sp.ean || 'N/A'}
                  {sp.stock_quantity && ` • Stock: ${sp.stock_quantity}`}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold">{formatPrice(sp.purchase_price)}</p>
                <p className="text-xs text-muted-foreground">Prix d'achat</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
