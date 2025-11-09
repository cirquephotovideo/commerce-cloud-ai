import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const RecentlyImportedProducts = () => {
  const [products, setProducts] = useState<any[]>([]);

  // Récupérer les produits récemment importés
  const { data: initialProducts } = useQuery({
    queryKey: ['recently-imported-products'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('supplier_products')
        .select('id, product_name, purchase_price, currency, enrichment_status, created_at, supplier_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  // Initialiser les produits
  useEffect(() => {
    if (initialProducts) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  // S'abonner aux nouveaux produits en temps réel
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
        (payload) => {
          console.log('📦 New product imported:', payload.new);
          setProducts((prev) => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">✅ Enrichi</Badge>;
      case 'pending':
        return <Badge variant="secondary">⏳ En attente</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">🔄 En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
                <TableCell>{getStatusBadge(product.enrichment_status)}</TableCell>
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
