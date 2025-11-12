import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { EnrichmentDetailBadge } from "./EnrichmentDetailBadge";

export const RecentlyImportedProducts = () => {
  const [products, setProducts] = useState<any[]>([]);

  // Récupérer les produits récemment importés avec enrichissement détaillé
  const { data: initialProducts } = useQuery({
    queryKey: ['recently-imported-products'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('supplier_products')
        .select('id, product_name, purchase_price, currency, enrichment_status, created_at, supplier_id, last_updated')
        .eq('user_id', user.id)
        .order('last_updated', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Récupérer les détails d'enrichissement pour chaque produit
      if (data) {
        const productsWithEnrichment = await Promise.all(
          data.map(async (product) => {
            const { data: enrichmentData } = await supabase.rpc(
              'get_product_enrichment_summary',
              { p_supplier_product_id: product.id }
            );
            return {
              ...product,
              enrichment_details: enrichmentData || { total: 0, items: {} }
            };
          })
        );
        return productsWithEnrichment;
      }
      
      return data || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Initialiser les produits
  useEffect(() => {
    if (initialProducts) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  // S'abonner aux nouveaux produits et mises à jour en temps réel
  useEffect(() => {
    const channel = supabase
      .channel('supplier-products-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'supplier_products',
        },
        async (payload) => {
          console.log('📦 New product imported:', payload.new);
          // Récupérer les détails d'enrichissement pour le nouveau produit
          const { data: enrichmentData } = await supabase.rpc(
            'get_product_enrichment_summary',
            { p_supplier_product_id: payload.new.id }
          );
          const productWithEnrichment = {
            ...payload.new,
            enrichment_details: enrichmentData || { total: 0, items: {} }
          };
          setProducts((prev) => [productWithEnrichment, ...prev].slice(0, 20));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'supplier_products',
        },
        async (payload) => {
          console.log('🔄 Product updated:', payload.new);
          // Récupérer les détails d'enrichissement pour le produit mis à jour
          const { data: enrichmentData } = await supabase.rpc(
            'get_product_enrichment_summary',
            { p_supplier_product_id: payload.new.id }
          );
          const productWithEnrichment = {
            ...payload.new,
            enrichment_details: enrichmentData || { total: 0, items: {} }
          };
          setProducts((prev) => {
            const updated = prev.map(p => p.id === payload.new.id ? productWithEnrichment : p);
            // Si le produit n'existe pas encore, l'ajouter en premier
            if (!prev.some(p => p.id === payload.new.id)) {
              return [productWithEnrichment, ...updated].slice(0, 20);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  if (!products || products.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Produits importés récemment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Prix d'achat</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Importé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="animate-in fade-in-50">
                <TableCell className="font-medium max-w-xs truncate">
                  {product.product_name}
                </TableCell>
                <TableCell>
                  {product.purchase_price ? (
                    <span className="font-semibold">
                      {product.purchase_price.toFixed(2)} {product.currency || '€'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  <EnrichmentDetailBadge enrichmentDetails={product.enrichment_details} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(product.created_at), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
