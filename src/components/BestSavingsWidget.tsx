import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, Package, Store, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface SavingsOpportunity {
  product_id: string;
  product_name: string;
  ean: string;
  supplier_count: number;
  best_price: number;
  worst_price: number;
  max_savings: number;
  avg_price: number;
  total_stock: number;
}

export const BestSavingsWidget = () => {
  const navigate = useNavigate();

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['best-savings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase.rpc('get_best_savings_opportunities', {
        p_user_id: user.id,
        p_limit: 5
      });

      if (error) throw error;
      return data as SavingsOpportunity[];
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30s
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 Meilleures Opportunités d'Économies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 Meilleures Opportunités d'Économies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune opportunité d'économies détectée</p>
            <p className="text-sm mt-2">
              Liez plusieurs fournisseurs à vos produits pour voir les économies potentielles
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💰 Meilleures Opportunités d'Économies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {opportunities.map((opp, index) => (
            <div 
              key={opp.product_id} 
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
              onClick={() => navigate(`/products?search=${encodeURIComponent(opp.ean || opp.product_name)}`)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {index === 0 && (
                    <Badge variant="default" className="bg-yellow-500">
                      🏆 Top 1
                    </Badge>
                  )}
                  <span className="font-semibold line-clamp-1">
                    {opp.product_name || 'Produit sans nom'}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    <span>{opp.supplier_count} fournisseurs</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>{opp.total_stock} unités</span>
                  </div>
                  
                  {opp.ean && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {opp.ean}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <p className="text-xl font-bold text-green-600">
                      {opp.max_savings.toFixed(2)}€
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {opp.best_price.toFixed(2)}€ → {opp.worst_price.toFixed(2)}€
                  </p>
                </div>
                
                <Button size="sm" variant="ghost">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {opportunities.length >= 5 && (
          <Button 
            variant="outline" 
            className="w-full mt-3"
            onClick={() => navigate('/products')}
          >
            Voir toutes les opportunités
          </Button>
        )}
      </CardContent>
    </Card>
  );
};