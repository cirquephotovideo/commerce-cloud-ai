import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, Package, AlertTriangle, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const CompetitiveDashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSavings: 0,
    bestDeals: [] as any[],
    riskProducts: [] as any[]
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les analyses de produits
      const { data: analyses } = await supabase
        .from('product_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!analyses) return;

      // Charger les offres concurrentes
      const { data: offers } = await supabase
        .from('price_monitoring')
        .select('*')
        .eq('user_id', user.id);

      // Calculer les statistiques
      let totalSavings = 0;
      const bestDeals: any[] = [];
      const riskProducts: any[] = [];

      analyses.forEach(analysis => {
        const result = analysis.analysis_result as any;
        const productName = result?.product_name || result?.name;
        const productPrice = parseFloat(
          (result?.price_analysis?.current_price || 
           result?.price || '0').toString().replace(/[^0-9.]/g, '')
        );

        // Trouver les offres pour ce produit
        const productOffers = offers?.filter(offer => 
          offer.product_name?.toLowerCase().includes(productName?.toLowerCase())
        ) || [];

        if (productOffers.length > 0) {
          const minPrice = Math.min(...productOffers.map(o => o.current_price || 0));
          const savings = productPrice - minPrice;
          
          if (savings > 0) {
            totalSavings += savings;
            bestDeals.push({
              name: productName,
              yourPrice: productPrice,
              bestPrice: minPrice,
              savings,
              savingsPercent: ((savings / productPrice) * 100).toFixed(1)
            });
          }
        }

        // Détecter les produits à risque (rupture de stock)
        const outOfStockOffers = productOffers.filter(o => 
          o.stock_status?.toLowerCase().includes('rupture') ||
          o.stock_status?.toLowerCase().includes('indisponible')
        );

        if (outOfStockOffers.length > productOffers.length * 0.5) {
          riskProducts.push({
            name: productName,
            reason: 'Rupture de stock chez plusieurs marchands'
          });
        }
      });

      setStats({
        totalProducts: analyses.length,
        totalSavings,
        bestDeals: bestDeals.sort((a, b) => b.savings - a.savings).slice(0, 5),
        riskProducts: riskProducts.slice(0, 5)
      });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produits Analysés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Économies Potentielles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalSavings.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Meilleures Affaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bestDeals.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Produits à Risque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.riskProducts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Meilleures Opportunités</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.bestDeals.map((deal, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{deal.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Votre prix: {deal.yourPrice}€ → Meilleur: {deal.bestPrice}€
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    -{deal.savingsPercent}%
                  </Badge>
                </div>
              ))}
              {stats.bestDeals.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune opportunité détectée
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.riskProducts.map((product, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.reason}</p>
                  </div>
                </div>
              ))}
              {stats.riskProducts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune alerte active
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};