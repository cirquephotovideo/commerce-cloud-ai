import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export const SubscriptionStatus = () => {
  const { subscribed, planName, limits, isLoading, getUsageCount, subscriptionEnd, isAdmin } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (limits) {
      loadUsage();
    }
  }, [limits]);

  const loadUsage = async () => {
    if (!limits) return;
    
    const usageData: Record<string, number> = {};
    for (const feature of Object.keys(limits) as Array<keyof typeof limits>) {
      usageData[feature] = await getUsageCount(feature);
    }
    setUsage(usageData);
  };

  const handleManageSubscription = async () => {
    try {
      setLoadingPortal(true);
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ouvrir le portail de gestion.",
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Show admin status for super admins
  if (isAdmin) {
    return (
      <Card className="border-primary bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Accès Administrateur
              </CardTitle>
              <CardDescription>
                Accès illimité à toutes les fonctionnalités
              </CardDescription>
            </div>
            <Badge variant="default" className="bg-primary">Admin</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {limits && Object.entries(limits).map(([feature]) => {
              const featureNames: Record<string, string> = {
                product_analyses: "Analyses de produits",
                google_shopping_searches: "Recherches Google Shopping",
                price_alerts: "Alertes prix",
                image_optimizations: "Optimisations d'images"
              };

              return (
                <div key={feature} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{featureNames[feature] || feature}</span>
                  <span className="font-medium text-primary">Illimité</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscribed || !limits) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Aucun abonnement actif
          </CardTitle>
          <CardDescription>
            Souscrivez à un plan pour débloquer toutes les fonctionnalités
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/pricing")} className="w-full">
            Voir les plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan {planName}
            </CardTitle>
            <CardDescription>
              {subscriptionEnd && `Renouvellement le ${formatDate(subscriptionEnd)}`}
            </CardDescription>
          </div>
          <Badge variant="default">Actif</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {Object.entries(limits).map(([feature, limit]) => {
            const currentUsage = usage[feature] || 0;
            const isUnlimited = limit === -1;
            const percentage = isUnlimited ? 0 : (currentUsage / limit) * 100;
            
            const featureNames: Record<string, string> = {
              product_analyses: "Analyses de produits",
              google_shopping_searches: "Recherches Google Shopping",
              price_alerts: "Alertes prix",
              image_optimizations: "Optimisations d'images"
            };

            return (
              <div key={feature} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{featureNames[feature] || feature}</span>
                  <span className="font-medium">
                    {isUnlimited ? "Illimité" : `${currentUsage} / ${limit}`}
                  </span>
                </div>
                {!isUnlimited && (
                  <Progress value={percentage} className="h-2" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleManageSubscription}
            disabled={loadingPortal}
          >
            {loadingPortal ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Gérer l'abonnement"
            )}
          </Button>
          <Button 
            variant="default" 
            className="flex-1"
            onClick={() => navigate("/pricing")}
          >
            Mettre à niveau
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
