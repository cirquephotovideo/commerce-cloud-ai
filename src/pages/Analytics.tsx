import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Euro, Upload, Link2, BarChart3, Sparkles } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BulkOperations } from "@/components/BulkOperations";
import { NotificationSettings } from "@/components/NotificationSettings";
import { APIKeyManager } from "@/components/APIKeyManager";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { AuditTrail } from "@/components/AuditTrail";

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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytiques Avancées</h1>
        <p className="text-muted-foreground">
          Tableaux de bord détaillés, opérations en masse et intégrations API
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="bulk">Opérations Masse</TabsTrigger>
          <TabsTrigger value="filters">Filtres</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {/* Les graphiques restent ici */}
        </TabsContent>

        <TabsContent value="bulk">
          <BulkOperations />
        </TabsContent>

        <TabsContent value="filters">
          <AdvancedFilters />
        </TabsContent>

        <TabsContent value="api">
          <APIKeyManager />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrail />
        </TabsContent>
      </Tabs>
    </div>
  );
}
