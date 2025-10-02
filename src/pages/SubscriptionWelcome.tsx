import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Loader2 } from "lucide-react";

const SubscriptionWelcome = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { planName, limits, isLoading, refreshSubscription } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(true);

  useEffect(() => {
    const refresh = async () => {
      setIsRefreshing(true);
      await refreshSubscription();
      setIsRefreshing(false);
    };
    
    // Rafraîchir l'abonnement après retour de Stripe
    refresh();
  }, []);

  if (isLoading || isRefreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Activation de votre abonnement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-2 border-purple-200/50 dark:border-purple-800/50">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Bienvenue dans votre nouvel abonnement ! 🎉
          </CardTitle>
          <CardDescription className="text-lg mt-4">
            Vous avez maintenant accès à toutes les fonctionnalités du plan <span className="font-semibold text-purple-600 dark:text-purple-400">{planName}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-8 pb-8">
          {limits && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 rounded-lg text-center border border-purple-200 dark:border-purple-800">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                  {limits.product_analyses === -1 ? '∞' : limits.product_analyses}
                </div>
                <div className="text-xs text-muted-foreground">Analyses/mois</div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {limits.google_shopping_searches === -1 ? '∞' : limits.google_shopping_searches}
                </div>
                <div className="text-xs text-muted-foreground">Recherches/mois</div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 rounded-lg text-center border border-amber-200 dark:border-amber-800">
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                  {limits.price_alerts === -1 ? '∞' : limits.price_alerts}
                </div>
                <div className="text-xs text-muted-foreground">Alertes prix</div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 rounded-lg text-center border border-green-200 dark:border-green-800">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {limits.image_optimizations === -1 ? '∞' : limits.image_optimizations}
                </div>
                <div className="text-xs text-muted-foreground">Images/mois</div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 p-6 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Ce que vous pouvez faire maintenant :
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Analyser vos produits</p>
                  <p className="text-sm text-muted-foreground">Obtenez des insights détaillés sur vos produits avec l'IA</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Surveiller les prix</p>
                  <p className="text-sm text-muted-foreground">Créez des alertes pour suivre la concurrence en temps réel</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Exporter vers vos plateformes</p>
                  <p className="text-sm text-muted-foreground">Connectez Shopify, WooCommerce, Odoo et bien plus</p>
                </div>
              </li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate('/dashboard')}
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg"
            >
              Commencer à utiliser la plateforme
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/pricing')}
              className="w-full"
            >
              Gérer mon abonnement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionWelcome;
