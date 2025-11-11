import { Card } from "@/components/ui/card";
import { Package, Boxes, ShoppingCart, TrendingUp, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  analyses: number;
  suppliers: number;
  code2asin: number;
  links: number;
}

export const GlobalProductStats = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const { data: stats, isLoading, refetch } = useQuery<Stats>({
    queryKey: ["global-product-stats", lastUpdate.getTime()],
    queryFn: async (): Promise<Stats> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { analyses: 0, suppliers: 0, code2asin: 0, links: 0 };

      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        
        if (!token) return { analyses: 0, suppliers: 0, code2asin: 0, links: 0 };

        const headers = {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        };

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;

        const [analysesRes, suppliersRes, code2asinRes, linksRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/product_analyses?select=id&user_id=eq.${user.id}`, { headers, method: 'HEAD' }),
          fetch(`${baseUrl}/rest/v1/supplier_products?select=id&user_id=eq.${user.id}`, { headers, method: 'HEAD' }),
          fetch(`${baseUrl}/rest/v1/code2asin_enrichments?select=id&user_id=eq.${user.id}`, { headers, method: 'HEAD' }),
          fetch(`${baseUrl}/rest/v1/product_links?select=id&user_id=eq.${user.id}`, { headers, method: 'HEAD' }),
        ]);

        const getCount = (response: Response): number => {
          const contentRange = response.headers.get('content-range');
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          }
          return 0;
        };

        return {
          analyses: getCount(analysesRes),
          suppliers: getCount(suppliersRes),
          code2asin: getCount(code2asinRes),
          links: getCount(linksRes),
        };
      } catch (error) {
        console.error("Error fetching stats:", error);
        return { analyses: 0, suppliers: 0, code2asin: 0, links: 0 };
      }
    },
    refetchInterval: false,
    staleTime: 0,
  });

  const handleRefresh = async () => {
    setLastUpdate(new Date());
    await queryClient.invalidateQueries({ queryKey: ["global-product-stats"] });
    await refetch();
    toast({
      title: "Statistiques actualisées",
      description: `Dernière mise à jour : ${new Date().toLocaleTimeString('fr-FR')}`,
    });
  };

  const statCards = [
    {
      title: "Produits Analysés",
      value: stats?.analyses ?? 0,
      icon: Package,
      color: "text-primary",
      description: "Total dans votre base",
    },
    {
      title: "Produits Fournisseurs",
      value: stats?.suppliers ?? 0,
      icon: Boxes,
      color: "text-chart-2",
      description: "Total dans votre base",
    },
    {
      title: "Enrichissements Amazon",
      value: stats?.code2asin ?? 0,
      icon: ShoppingCart,
      color: "text-chart-3",
      description: "Total dans votre base",
    },
    {
      title: "Liens Automatiques",
      value: stats?.links ?? 0,
      icon: TrendingUp,
      color: "text-chart-4",
      description: "Créés automatiquement par EAN",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR')}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-2">{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </div>
              <Icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </Card>
        );
      })}
      </div>
    </div>
  );
};
