import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SupplierPricesTable } from './SupplierPricesTable';

interface ProductPreviewCardProps {
  analysisId: string;
}

export const ProductPreviewCard = ({ analysisId }: ProductPreviewCardProps) => {
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data, error } = await supabase
          .from('product_analyses')
          .select('*')
          .eq('id', analysisId)
          .single();

        if (error) throw error;
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [analysisId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-20 w-20 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!product) return null;

  const imageUrl = product.image_urls?.[0] || '/placeholder.svg';
  const productName = product.analysis_result?.name || 'Produit sans nom';
  const ean = product.analysis_result?.ean || product.analysis_result?.barcode || 'N/A';
  
  // Handle both old (number) and new (object) enrichment_score formats
  const enrichmentScoreValue = typeof product.analysis_result?.enrichment_score === 'object'
    ? product.analysis_result?.enrichment_score?.overall || 0
    : product.analysis_result?.enrichment_score || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Aperçu Produit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <img
            src={imageUrl}
            alt={productName}
            className="h-20 w-20 rounded-md object-cover border"
          />
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold">{productName}</h3>
            <p className="text-sm text-muted-foreground">EAN: {ean}</p>
            {enrichmentScoreValue > 0 && (
              <Badge variant={enrichmentScoreValue > 80 ? 'default' : 'secondary'}>
                ✨ Score: {enrichmentScoreValue}/100
              </Badge>
            )}
          </div>
        </div>

        <SupplierPricesTable analysisId={analysisId} compact />
      </CardContent>
    </Card>
  );
};
