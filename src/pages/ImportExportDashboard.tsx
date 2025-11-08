import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoExportRules } from "@/components/AutoExportRules";
import { ExportScheduler } from "@/components/ExportScheduler";
import { ExportHistoryDialog } from "@/components/ExportHistoryDialog";
import { PlatformImportSection } from "@/components/import/PlatformImportSection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Package, TrendingUp, AlertCircle, Calendar, Loader2, Download, Upload } from "lucide-react";

export default function ImportExportDashboard() {
  const [showHistory, setShowHistory] = useState(false);

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

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Import / Export</h1>
            <p className="text-muted-foreground">
              Gérez vos imports fournisseurs et exports multi-plateformes
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowHistory(true)}>
          <History className="w-4 h-4 mr-2" />
          Historique
        </Button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-4 gap-4">
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

      <Tabs defaultValue="imports" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="imports">
            <Download className="w-4 h-4 mr-2" />
            Imports
          </TabsTrigger>
          <TabsTrigger value="export-rules">
            <Package className="w-4 h-4 mr-2" />
            Règles d'Export
          </TabsTrigger>
          <TabsTrigger value="scheduler">
            <Calendar className="w-4 h-4 mr-2" />
            Planification
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="w-4 h-4 mr-2" />
            Activité Récente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="space-y-4">
          <PlatformImportSection />
        </TabsContent>

        <TabsContent value="export-rules" className="space-y-4">
          <AutoExportRules />
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <ExportScheduler />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
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
        </TabsContent>
      </Tabs>

      <ExportHistoryDialog 
        open={showHistory} 
        onOpenChange={setShowHistory}
      />
    </div>
  );
}
