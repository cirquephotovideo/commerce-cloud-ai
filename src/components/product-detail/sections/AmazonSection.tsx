import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ExternalLink, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AmazonSectionProps {
  analysisId: string;
}

export const AmazonSection = ({ analysisId }: AmazonSectionProps) => {
  const { data: amazonData, isLoading, refetch } = useQuery({
    queryKey: ['amazon-data', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_product_data')
        .select('*')
        .eq('analysis_id', analysisId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Amazon Seller Central
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!amazonData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Amazon Seller Central
          </CardTitle>
          <CardDescription>
            Données Amazon non disponibles
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Amazon Seller Central
        </CardTitle>
        <CardDescription>
          Données enrichies depuis Amazon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">ASIN</div>
            <div className="font-mono font-medium">{amazonData.asin}</div>
          </div>
          
          {amazonData.sales_rank && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Ranking</div>
              <Badge variant="outline">
                #{(amazonData.sales_rank as any)?.rank || 'N/A'}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {amazonData.buy_box_price && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Prix Amazon</div>
              <div className="text-lg font-bold">{amazonData.buy_box_price}€</div>
            </div>
          )}
          
          {amazonData.fba_new_price && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Prix FBA</div>
              <div className="text-lg font-bold">{amazonData.fba_new_price}€</div>
            </div>
          )}
          
          {amazonData.offer_count_new && (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Offres actives</div>
              <Badge variant="default">{amazonData.offer_count_new}</Badge>
            </div>
          )}
        </div>

        {amazonData.buy_box_seller_name && (
          <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
            <div className="text-sm font-medium">Buy Box</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendeur:</span>
                <span className="font-medium">{amazonData.buy_box_seller_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prix:</span>
                <span className="font-medium">{amazonData.buy_box_price}€</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href={`https://www.amazon.fr/dp/${amazonData.asin}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Voir sur Amazon
            </a>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
            Actualiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
