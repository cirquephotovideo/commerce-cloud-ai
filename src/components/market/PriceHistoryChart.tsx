import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Loader2 } from "lucide-react";

interface PriceHistoryChartProps {
  productName: string;
  priceMonitoringId?: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

export const PriceHistoryChart = ({ productName, priceMonitoringId, timeRange = '30d' }: PriceHistoryChartProps) => {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadPriceHistory();
  }, [productName, priceMonitoringId, timeRange]);

  const loadPriceHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('price_history')
        .select('*')
        .eq('user_id', user.id)
        .order('scraped_at', { ascending: true });

      if (priceMonitoringId) {
        query = query.eq('price_monitoring_id', priceMonitoringId);
      }

      // Filter by time range
      if (timeRange !== 'all') {
        const days = parseInt(timeRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('scraped_at', cutoffDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Format data for chart
        const formattedData = data.map(item => ({
          date: new Date(item.scraped_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          fullDate: item.scraped_at,
          price: item.price,
          source: item.source,
          stock: item.stock_status,
        }));

        // Calculate statistics
        const prices = data.map(d => d.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const currentPrice = prices[prices.length - 1];
        const priceChange = ((currentPrice - prices[0]) / prices[0]) * 100;

        setStats({
          avgPrice,
          minPrice,
          maxPrice,
          currentPrice,
          priceChange,
        });

        setHistoryData(formattedData);
      }
    } catch (error) {
      console.error('Error loading price history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (historyData.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Aucun historique de prix disponible pour ce produit
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution du Prix - {productName}</CardTitle>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Prix actuel</p>
              <p className="font-bold text-lg">{stats.currentPrice.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prix moyen</p>
              <p className="font-bold">{stats.avgPrice.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prix min</p>
              <p className="font-bold text-green-600">{stats.minPrice.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-muted-foreground">Prix max</p>
              <p className="font-bold text-red-600">{stats.maxPrice.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-muted-foreground">Évolution</p>
              <p className={`font-bold ${stats.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.priceChange > 0 ? '+' : ''}{stats.priceChange.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              domain={['dataMin - 10', 'dataMax + 10']}
              tickFormatter={(value) => `${value}€`}
            />
            <Tooltip 
              formatter={(value: any) => [`${value.toFixed(2)}€`, 'Prix']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            
            {/* Reference lines */}
            {stats && (
              <>
                <ReferenceLine 
                  y={stats.avgPrice} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="3 3" 
                  label="Prix moyen"
                />
                <ReferenceLine 
                  y={stats.minPrice} 
                  stroke="hsl(var(--success))" 
                  strokeDasharray="3 3" 
                  label="Meilleur prix"
                />
              </>
            )}
            
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
