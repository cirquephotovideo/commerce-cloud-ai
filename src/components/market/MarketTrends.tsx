import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Package, AlertCircle, Calendar } from "lucide-react";

export const MarketTrends = () => {
  const [trends, setTrends] = useState<any[]>([]);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    const { data } = await supabase
      .from('market_trends')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(20);
    
    setTrends(data || []);
  };

  const getTrendIcon = (type: string) => {
    switch (type) {
      case 'price_drop': return <TrendingDown className="w-5 h-5" />;
      case 'new_release': return <Package className="w-5 h-5" />;
      case 'stock_alert': return <AlertCircle className="w-5 h-5" />;
      case 'seasonal': return <Calendar className="w-5 h-5" />;
      default: return null;
    }
  };

  const getTrendLabel = (type: string) => {
    switch (type) {
      case 'price_drop': return 'Baisse de Prix';
      case 'new_release': return 'Nouvelle Sortie';
      case 'stock_alert': return 'Alerte Stock';
      case 'seasonal': return 'Tendance Saisonnière';
      default: return type;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendances Détectées</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {trends.map((trend) => (
            <div key={trend.id} className="flex items-start gap-4 p-4 border rounded-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                {getTrendIcon(trend.trend_type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{getTrendLabel(trend.trend_type)}</Badge>
                  {trend.product_category && (
                    <Badge variant="secondary">{trend.product_category}</Badge>
                  )}
                  <div className={`w-2 h-2 rounded-full ${getConfidenceColor(trend.confidence_score)}`} />
                </div>
                <div className="text-sm">
                  {JSON.stringify(trend.trend_data, null, 2)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Détecté le {new Date(trend.detected_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {trends.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune tendance détectée pour le moment
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};