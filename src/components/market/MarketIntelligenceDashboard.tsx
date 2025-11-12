import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TrendingDown, TrendingUp, AlertTriangle, Info, RefreshCw, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MarketIntelligenceData {
  id: string;
  product_name: string;
  product_ean: string | null;
  amazon_price: number | null;
  google_shopping_min_price: number | null;
  google_shopping_max_price: number | null;
  google_shopping_avg_price: number | null;
  current_user_price: number | null;
  competitors_count: number;
  market_position: string;
  ai_recommendation: string;
  ai_confidence_score: number;
  ai_reasoning: string;
  search_volume_trend: string;
  market_demand: string;
  alert_type: string | null;
  alert_severity: string;
  check_timestamp: string;
}

export const MarketIntelligenceDashboard = () => {
  const [data, setData] = useState<MarketIntelligenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    return !!session;
  };

  const loadData = async () => {
    try {
      const hasSession = await checkAuth();
      if (!hasSession) {
        setLoading(false);
        return;
      }

      const { data: marketData, error } = await supabase
        .from('market_intelligence_data')
        .select('*')
        .order('check_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setData(marketData || []);
    } catch (error) {
      console.error('Error loading market intelligence:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données d'intelligence marché",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Non authentifié",
          description: "Vous devez être connecté pour lancer l'analyse",
          variant: "destructive"
        });
        return;
      }

      console.log('[MARKET-INTELLIGENCE] Starting analysis...');

      const { data: result, error } = await supabase.functions.invoke(
        'market-intelligence-scheduler',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (error) {
        console.error('[MARKET-INTELLIGENCE] Error:', error);
        throw error;
      }

      console.log('[MARKET-INTELLIGENCE] Analysis result:', result);

      toast({
        title: "Analyse terminée",
        description: `${result.analyzed} produits analysés avec succès`,
      });

      await loadData();
    } catch (error) {
      console.error('[MARKET-INTELLIGENCE] Error running analysis:', error);
      toast({
        title: "Erreur d'analyse",
        description: error.message || "Échec de l'analyse de marché. Vérifiez que vous êtes bien connecté.",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'lower_price':
        return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case 'increase_price':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRecommendationLabel = (recommendation: string) => {
    const labels: Record<string, string> = {
      'lower_price': 'Baisser le prix',
      'increase_price': 'Augmenter le prix',
      'maintain': 'Prix optimal',
      'review': 'À surveiller'
    };
    return labels[recommendation] || recommendation;
  };

  const getMarketPositionBadge = (position: string) => {
    const variants: Record<string, any> = {
      'cheapest': { label: 'Le moins cher', variant: 'default' },
      'average': { label: 'Prix moyen', variant: 'secondary' },
      'expensive': { label: 'Cher', variant: 'destructive' },
      'above_average': { label: 'Au-dessus moyenne', variant: 'outline' }
    };
    const config = variants[position] || { label: position, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
          <h3 className="text-lg font-semibold mb-2">Authentification requise</h3>
          <p className="text-muted-foreground">
            Vous devez être connecté pour accéder à l'intelligence marché
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Intelligence Marché en Temps Réel
            </h2>
            <p className="text-muted-foreground mt-1">
              Analyse automatique des prix et recommandations IA
            </p>
          </div>
          <Button 
            onClick={runAnalysis} 
            disabled={analyzing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
          </Button>
        </div>

        {data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Aucune donnée d'intelligence marché disponible
            </p>
            <Button onClick={runAnalysis} disabled={analyzing}>
              Lancer la première analyse
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.product_name}</h3>
                    {item.product_ean && (
                      <p className="text-sm text-muted-foreground">EAN: {item.product_ean}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {getMarketPositionBadge(item.market_position)}
                    {item.alert_type && (
                      <Badge variant={item.alert_severity === 'warning' ? 'destructive' : 'outline'}>
                        {item.alert_type}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Votre prix</p>
                    <p className="text-xl font-bold">
                      {item.current_user_price ? `${item.current_user_price.toFixed(2)} €` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Prix moyen marché</p>
                    <p className="text-xl font-bold">
                      {item.google_shopping_avg_price ? `${item.google_shopping_avg_price.toFixed(2)} €` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Concurrents</p>
                    <p className="text-xl font-bold">{item.competitors_count}</p>
                  </div>
                </div>

                {item.google_shopping_min_price && item.google_shopping_max_price && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">Fourchette de prix marché</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{item.google_shopping_min_price.toFixed(2)} €</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ 
                            width: item.current_user_price 
                              ? `${Math.min(100, ((item.current_user_price - item.google_shopping_min_price) / (item.google_shopping_max_price - item.google_shopping_min_price)) * 100)}%`
                              : '50%'
                          }}
                        />
                      </div>
                      <span className="font-semibold">{item.google_shopping_max_price.toFixed(2)} €</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 bg-muted/30 p-4 rounded-lg">
                  <div className="mt-1">
                    {getSeverityIcon(item.alert_severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getRecommendationIcon(item.ai_recommendation)}
                      <span className="font-semibold">
                        {getRecommendationLabel(item.ai_recommendation)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        (Confiance: {(item.ai_confidence_score * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.ai_reasoning}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span>Demande marché: {item.market_demand}</span>
                  <span>Analysé le {new Date(item.check_timestamp).toLocaleString('fr-FR')}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};