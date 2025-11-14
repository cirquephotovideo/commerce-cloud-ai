import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentImportedProductsProps {
  supplierId: string;
  limit?: number;
}

export const RecentImportedProducts = ({ supplierId, limit = 5 }: RecentImportedProductsProps) => {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('supplier_products')
          .select('*')
          .eq('supplier_id', supplierId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching recent products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentProducts();
  }, [supplierId, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📦 Derniers Produits Importés</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50">
              <div className="flex-1">
                <div className="font-medium text-sm">{product.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  Réf: {product.supplier_reference} | EAN: {product.ean || 'N/A'}
                </div>
              </div>
              <Badge variant="secondary">
                {product.purchase_price?.toFixed(2)}€
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
