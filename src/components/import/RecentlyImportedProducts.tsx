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
  const { data: initialProducts, error } = useQuery({
    queryKey: ['recently-imported-products'],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
          .from('supplier_products')
          .select('id, product_name, purchase_price, currency, enrichment_status, created_at, supplier_id, last_updated')
          .eq('user_id', user.id)
          .order('last_updated', { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!data || data.length === 0) return [];
        
        // ✅ UN SEUL appel RPC pour tous les produits
        const productIds = data.map(p => p.id);
        const { data: enrichmentBatch } = await supabase.rpc(
          'get_products_enrichment_batch',
          { p_product_ids: productIds }
        );

        // Mapper les enrichissements aux produits
        const enrichmentMap = new Map(
          enrichmentBatch?.map((item: any) => [item.product_id, item.enrichment_summary]) || []
        );

        return data.map(product => ({
          ...product,
          enrichment_details: enrichmentMap.get(product.id) || { total: 0, items: {} }
        }));
      } catch (err) {
        console.error('Error loading products:', err);
        return [];
      }
    },
    refetchInterval: 10000,
    retry: 3,
    retryDelay: 1000,
  });

  // Initialiser les produits
  useEffect(() => {
    if (initialProducts) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  // S'abonner aux nouveaux produits et mises à jour en temps réel
  useEffect(() => {
    const fetchEnrichmentDetails = async (productId: string) => {
      const { data } = await supabase.rpc(
        'get_products_enrichment_batch',
        { p_product_ids: [productId] }
      );
      return data?.[0]?.enrichment_summary || { total: 0, items: {} };
    };

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
          const enrichment_details = await fetchEnrichmentDetails(payload.new.id);
          setProducts((prev) => [{...payload.new, enrichment_details}, ...prev].slice(0, 20));
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
          const enrichment_details = await fetchEnrichmentDetails(payload.new.id);
          const productWithEnrichment = {...payload.new, enrichment_details};
          setProducts((prev) => {
            const updated = prev.map(p => p.id === payload.new.id ? productWithEnrichment : p);
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
