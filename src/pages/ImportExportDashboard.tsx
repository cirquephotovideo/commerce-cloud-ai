import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Download, AlertCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function ImportExportDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  // Stats globales
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['import-export-stats'],
    queryFn: async () => {
      const [importsRes, exportsRes, pendingRes, errorsRes] = await Promise.all([
        supabase.from('supplier_import_logs').select('id', { count: 'exact', head: true }),
        supabase.from('export_history').select('id', { count: 'exact', head: true }).eq('status', 'success'),
        supabase.from('supplier_products').select('id', { count: 'exact', head: true }).eq('enrichment_status', 'pending'),
        supabase.from('export_history').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      ]);

      return {
        totalImports: importsRes.count || 0,
        successfulExports: exportsRes.count || 0,
        pendingEnrichments: pendingRes.count || 0,
        errors: errorsRes.count || 0,
      };
    },
  });

  // Imports par plateforme
  const { data: importsByPlatform } = useQuery({
    queryKey: ['imports-by-platform'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_import_logs')
        .select('import_type, products_found')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const grouped = data.reduce((acc: any, curr) => {
        const platform = curr.import_type || 'unknown';
        if (!acc[platform]) {
          acc[platform] = { name: platform, total: 0 };
        }
        acc[platform].total += curr.products_found || 0;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  // Exports par plateforme
  const { data: exportsByPlatform } = useQuery({
    queryKey: ['exports-by-platform'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('export_history')
        .select('platform_type, id')
        .gte('exported_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .eq('status', 'success');

      if (error) throw error;

      const grouped = data.reduce((acc: any, curr) => {
        const platform = curr.platform_type;
        if (!acc[platform]) {
          acc[platform] = { name: platform, value: 0 };
        }
        acc[platform].value += 1;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  // Activité récente
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [imports, exports] = await Promise.all([
        supabase
          .from('supplier_import_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('export_history')
          .select('*')
          .order('exported_at', { ascending: false })
          .limit(10),
      ]);

      const combined = [
        ...(imports.data || []).map(i => ({
          id: i.id,
          type: 'import',
          platform: i.import_type || 'unknown',
          product_count: i.products_found || 0,
          status: i.import_status,
          created_at: i.created_at,
        })),
        ...(exports.data || []).map(e => ({
          id: e.id,
          type: 'export',
          platform: e.platform_type,
          product_count: 1,
          status: e.status,
          created_at: e.exported_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined.slice(0, 15);
    },
  });

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Dashboard Import/Export</h1>

        {/* Stats globales */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{stats?.totalImports || 0}</div>
                  <p className="text-sm text-muted-foreground">Imports totaux</p>
                </div>
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-500">{stats?.successfulExports || 0}</div>
                  <p className="text-sm text-muted-foreground">Exports réussis</p>
                </div>
                <Download className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-orange-500">{stats?.pendingEnrichments || 0}</div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-red-500">{stats?.errors || 0}</div>
                  <p className="text-sm text-muted-foreground">Erreurs</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Imports par Plateforme (30j)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={importsByPlatform || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exports par Plateforme (30j)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={exportsByPlatform || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {(exportsByPlatform || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Plateforme</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity?.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-sm">
                      {new Date(activity.created_at).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={activity.type === 'import' ? 'default' : 'secondary'}>
                        {activity.type === 'import' ? '📥 Import' : '📤 Export'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{activity.platform}</TableCell>
                    <TableCell className="font-semibold">{activity.product_count}</TableCell>
                    <TableCell>
                      <Badge variant={
                        activity.status === 'success' ? 'default' :
                        activity.status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {activity.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!recentActivity || recentActivity.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune activité récente
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}