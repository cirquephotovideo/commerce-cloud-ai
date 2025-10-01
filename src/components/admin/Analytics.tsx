import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Users, DollarSign, Activity, BarChart3 } from "lucide-react";

interface AnalyticsData {
  totalUsers: number;
  activeSubscriptions: number;
  mrr: number;
  totalAnalyses: number;
}

export const Analytics = () => {
  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 0,
    activeSubscriptions: 0,
    mrr: 0,
    totalAnalyses: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch total users
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch active subscriptions
      const { count: subsCount } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Fetch active subscriptions with plans to calculate MRR
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select(`
          billing_interval,
          subscription_plans (
            price_monthly,
            price_yearly
          )
        `)
        .eq("status", "active");

      let mrr = 0;
      if (subs) {
        subs.forEach((sub: any) => {
          if (sub.billing_interval === "monthly") {
            mrr += sub.subscription_plans?.price_monthly || 0;
          } else if (sub.billing_interval === "yearly") {
            mrr += (sub.subscription_plans?.price_yearly || 0) / 12;
          }
        });
      }

      // Fetch total analyses
      const { count: analysesCount } = await supabase
        .from("product_analyses")
        .select("*", { count: "exact", head: true });

      setData({
        totalUsers: usersCount || 0,
        activeSubscriptions: subsCount || 0,
        mrr: Math.round(mrr),
        totalAnalyses: analysesCount || 0,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ title, value, icon: Icon, suffix = "" }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? "..." : `${value}${suffix}`}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Utilisateurs Totaux"
          value={data.totalUsers}
          icon={Users}
        />
        <MetricCard
          title="Abonnements Actifs"
          value={data.activeSubscriptions}
          icon={TrendingUp}
        />
        <MetricCard
          title="MRR"
          value={data.mrr}
          icon={DollarSign}
          suffix="€"
        />
        <MetricCard
          title="Analyses Totales"
          value={data.totalAnalyses}
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Revenus par Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Graphique à venir : Distribution des revenus par plan d'abonnement
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
