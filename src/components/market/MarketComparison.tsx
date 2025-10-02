import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, TrendingDown, AlertTriangle } from "lucide-react";
import { PriceHistoryChart } from "./PriceHistoryChart";

export const MarketComparison = () => {
  const [stats, setStats] = useState<any>(null);
  const [trackedProducts, setTrackedProducts] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComparisonData();
  }, []);

  const loadComparisonData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load monitoring data grouped by product
      const { data: monitoringData } = await supabase
        .from('price_monitoring')
        .select('*')
        .eq('user_id', user.id)
        .order('scraped_at', { ascending: false })
        .limit(100);

      if (monitoringData) {
        // Group by product name
        const productMap = new Map();
        monitoringData.forEach(item => {
          if (!productMap.has(item.product_name)) {
            productMap.set(item.product_name, []);
          }
          productMap.get(item.product_name).push(item);
        });

        const products = Array.from(productMap.entries()).map(([name, items]: [string, any[]]) => ({
          name,
          offers: items,
          bestPrice: Math.min(...items.map((i: any) => i.current_price)),
          avgPrice: items.reduce((a: number, b: any) => a + b.current_price, 0) / items.length,
          sources: [...new Set(items.map((i: any) => i.search_engine))],
        }));

        setTrackedProducts(products);

        // Calculate statistics
        const googleResults = monitoringData.filter(d => d.search_engine === 'google' || d.search_engine === 'dual');
        const serperResults = monitoringData.filter(d => d.search_engine === 'serper' || d.search_engine === 'dual');
        const dualValidated = monitoringData.filter(d => d.search_engine === 'dual');

        const avgConfidenceGoogle = googleResults.reduce((a, b) => a + (b.confidence_score || 0), 0) / googleResults.length;
        const avgConfidenceSerper = serperResults.reduce((a, b) => a + (b.confidence_score || 0), 0) / serperResults.length;
        const avgResponseTime = monitoringData.reduce((a, b) => {
          const metadata = b.search_metadata as any;
          return a + (metadata?.response_time_ms || 0);
        }, 0) / monitoringData.length;

        setStats({
          totalResults: monitoringData.length,
          googleResults: googleResults.length,
          serperResults: serperResults.length,
          dualValidated: dualValidated.length,
          avgConfidenceGoogle: avgConfidenceGoogle * 100,
          avgConfidenceSerper: avgConfidenceSerper * 100,
          avgResponseTime,
          googleSuccessRate: (googleResults.length / monitoringData.length) * 100,
          serperSuccessRate: (serperResults.length / monitoringData.length) * 100,
        });
      }

      // Load active price alerts
      const { data: alerts } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('alert_type', 'price_drop')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (alerts) {
        setActiveAlerts(alerts);
      }
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Global Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Résultats totaux</p>
                <p className="text-2xl font-bold">{stats.totalResults}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Validation croisée</p>
                <p className="text-2xl font-bold">{stats.dualValidated}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps moyen</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime.toFixed(0)}ms</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes actives</p>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Reliability */}
      <Card>
        <CardHeader>
          <CardTitle>Fiabilité des Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Google Custom Search</span>
                <Badge variant="secondary">{stats.googleResults} résultats</Badge>
              </div>
              <span className="font-bold">{stats.avgConfidenceGoogle.toFixed(0)}%</span>
            </div>
            <Progress value={stats.avgConfidenceGoogle} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              Taux de succès: {stats.googleSuccessRate.toFixed(1)}%
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Serper.dev</span>
                <Badge variant="secondary">{stats.serperResults} résultats</Badge>
              </div>
              <span className="font-bold">{stats.avgConfidenceSerper.toFixed(0)}%</span>
            </div>
            <Progress value={stats.avgConfidenceSerper} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              Taux de succès: {stats.serperSuccessRate.toFixed(1)}%
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Validation croisée (Dual-Engine)</span>
                <Badge variant="default">{stats.dualValidated} validations</Badge>
              </div>
              <span className="font-bold text-green-600">
                {((stats.dualValidated / stats.totalResults) * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={(stats.dualValidated / stats.totalResults) * 100} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              Produits confirmés par les 2 moteurs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Alertes de Prix Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{alert.alert_data.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.alert_data.promotion_count} promotion(s) détectée(s)
                    </p>
                  </div>
                  <Badge variant="destructive">PROMO</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracked Products with Charts */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Produits Suivis</h3>
        {trackedProducts.slice(0, 5).map(product => (
          <div key={product.name}>
            <PriceHistoryChart productName={product.name} timeRange="30d" />
          </div>
        ))}
      </div>
    </div>
  );
};
