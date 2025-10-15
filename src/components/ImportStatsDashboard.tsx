import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Package, AlertCircle, DollarSign, Clock } from "lucide-react";

export function ImportStatsDashboard() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  // Récupérer les statistiques
  const { data: stats, isLoading } = useQuery({
    queryKey: ["import-stats", period],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      const { data, error } = await supabase
        .from("import_statistics")
        .select("*")
        .eq("user_id", user.id)
        .gte("import_date", daysAgo.toISOString())
        .order("import_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Récupérer les erreurs non résolues
  const { data: errors } = useQuery({
    queryKey: ["import-errors-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { count, error } = await supabase
        .from("import_errors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("resolved_at", null);

      if (error) throw error;
      return count || 0;
    },
  });

  // Calculer les métriques globales
  const totalImports = stats?.reduce((sum, s) => sum + (s.total_imports || 0), 0) || 0;
  const successImports = stats?.reduce((sum, s) => sum + (s.success_count || 0), 0) || 0;
  const errorImports = stats?.reduce((sum, s) => sum + (s.error_count || 0), 0) || 0;
  const totalProducts = stats?.reduce((sum, s) => sum + (s.total_products_created || 0) + (s.total_products_updated || 0), 0) || 0;
  const successRate = totalImports > 0 ? (successImports / totalImports * 100).toFixed(1) : "0";

  // Préparer les données pour les graphiques
  const lineChartData = stats?.map(s => ({
    date: new Date(s.import_date).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
    imports: s.total_imports || 0,
    succès: s.success_count || 0,
    erreurs: s.error_count || 0,
  })) || [];

  const pieChartData = [
    { name: "Succès", value: successImports, color: "#22c55e" },
    { name: "Erreurs", value: errorImports, color: "#ef4444" },
  ];

  if (isLoading) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tableau de bord statistiques</h2>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards métriques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Imports</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalImports}</div>
            <p className="text-xs text-muted-foreground">{period} derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de succès</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {successImports} / {totalImports} imports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erreurs actives</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errors}</div>
            <p className="text-xs text-muted-foreground">Non résolues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits traités</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">Créés/Mis à jour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits / Import</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalImports > 0 ? (totalProducts / totalImports).toFixed(1) : "0"}
            </div>
            <p className="text-xs text-muted-foreground">Moyenne</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Évolution des imports</CardTitle>
            <CardDescription>Nombre d'imports par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="imports" stroke="hsl(var(--primary))" name="Total" />
                <Line type="monotone" dataKey="succès" stroke="#22c55e" name="Succès" />
                <Line type="monotone" dataKey="erreurs" stroke="#ef4444" name="Erreurs" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition succès/erreurs</CardTitle>
            <CardDescription>Taux de réussite global</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
