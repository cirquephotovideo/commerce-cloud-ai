import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, Euro, Upload, AlertCircle, Sparkles, Link2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Analytics() {
  // Stats globales
  const { data: stats } = useQuery({
    queryKey: ["analytics-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const [
        { count: analysesCount },
        { count: supplierProductsCount },
        { count: linkedCount },
        { data: exportData },
      ] = await Promise.all([
        supabase.from("product_analyses").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("supplier_products").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("product_links").select("*", { count: "exact", head: true }),
        supabase.from("export_history").select("*").eq("user_id", user.id).eq("status", "success"),
      ]);

      return {
        totalProducts: (analysesCount || 0) + (supplierProductsCount || 0),
        analyses: analysesCount || 0,
        supplierProducts: supplierProductsCount || 0,
        linkedProducts: linkedCount || 0,
        linkRate: supplierProductsCount ? Math.round((linkedCount || 0) / supplierProductsCount * 100) : 0,
        monthlyExports: exportData?.length || 0,
      };
    },
  });

  // Évolution temporelle
  const { data: timeSeriesData } = useQuery({
    queryKey: ["analytics-timeseries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: analyses } = await supabase
        .from("product_analyses")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at");

      const { data: imports } = await supabase
        .from("supplier_products")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at");

      // Grouper par jour
      const grouped: Record<string, { date: string; analyses: number; imports: number }> = {};
      
      analyses?.forEach(a => {
        const date = new Date(a.created_at).toLocaleDateString("fr-FR");
        if (!grouped[date]) grouped[date] = { date, analyses: 0, imports: 0 };
        grouped[date].analyses++;
      });

      imports?.forEach(i => {
        const date = new Date(i.created_at).toLocaleDateString("fr-FR");
        if (!grouped[date]) grouped[date] = { date, analyses: 0, imports: 0 };
        grouped[date].imports++;
      });

      return Object.values(grouped).slice(-30); // 30 derniers jours
    },
  });

  // Répartition par fournisseur
  const { data: supplierDistribution } = useQuery({
    queryKey: ["analytics-suppliers"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data } = await supabase
        .from("supplier_products")
        .select(`
          supplier_id,
          supplier_configurations(supplier_name)
        `)
        .eq("user_id", user.id);

      const counts: Record<string, number> = {};
      data?.forEach(p => {
        const name = p.supplier_configurations?.supplier_name || "Inconnu";
        counts[name] = (counts[name] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre activité produits</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits Totaux</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.analyses} analyses + {stats?.supplierProducts} importés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de liaison</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.linkRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.linkedProducts} produits liés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrichissement</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-muted-foreground">
              Taux d'enrichissement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exports ce mois</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.monthlyExports || 0}</div>
            <p className="text-xs text-muted-foreground">
              Exports réussis
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Évolution Analyses/Imports</CardTitle>
            <CardDescription>30 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="analyses" stroke="hsl(var(--primary))" name="Analyses" />
                <Line type="monotone" dataKey="imports" stroke="hsl(var(--secondary))" name="Imports" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par Fournisseur</CardTitle>
            <CardDescription>Distribution des produits importés</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={supplierDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {supplierDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      <Card>
        <CardHeader>
          <CardTitle>Alertes & Recommandations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats && stats.supplierProducts - stats.linkedProducts > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{stats.supplierProducts - stats.linkedProducts} produits non liés</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>Ces produits ne sont pas encore associés à des analyses.</span>
                <Button variant="link" size="sm">Lier automatiquement</Button>
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Bonne performance !</AlertTitle>
            <AlertDescription className="text-green-600">
              Taux de succès d'export de {stats ? Math.round((stats.monthlyExports / stats.totalProducts) * 100) : 0}%
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
