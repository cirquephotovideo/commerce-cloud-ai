import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Download, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PLATFORM_ICONS: Record<string, string> = {
  odoo: "🏢",
  prestashop: "🛒",
  "amazon-seller-mcp": "📦",
};

export const MCPCallLogs = () => {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("7d");

  // Fetch logs avec filtres
  const { data: logs, isLoading } = useQuery({
    queryKey: ['mcp-call-logs', platformFilter, statusFilter, periodFilter],
    queryFn: async () => {
      let query = supabase
        .from('mcp_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Filtre par période
      const now = new Date();
      if (periodFilter === '24h') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        query = query.gte('created_at', yesterday.toISOString());
      } else if (periodFilter === '7d') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (periodFilter === '30d') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', monthAgo.toISOString());
      }

      // Filtre par package
      if (platformFilter !== 'all') {
        query = query.eq('package_id', platformFilter);
      }

      // Filtre par statut
      if (statusFilter !== 'all') {
        const isSuccess = statusFilter === 'success';
        query = query.eq('success', isSuccess);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch packages pour le filtre
  const { data: packages } = useQuery({
    queryKey: ['platform-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('id, platform_type');
      if (error) throw error;
      return data || [];
    }
  });

  // Statistiques
  const stats = {
    total: logs?.length || 0,
    success: logs?.filter(l => l.success).length || 0,
    error: logs?.filter(l => !l.success).length || 0,
    avgLatency: logs?.reduce((acc, l) => acc + (l.latency_ms || 0), 0) / (logs?.length || 1) || 0,
  };

  const exportToCSV = () => {
    if (!logs || logs.length === 0) return;
    
    const headers = ['Date', 'Package', 'Outil', 'Statut', 'Latence (ms)', 'Message'];
    const rows = logs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr }),
      log.package_id,
      log.tool_name,
      log.success ? 'success' : 'error',
      log.latency_ms || 'N/A',
      log.error_message || 'Success'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mcp-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted animate-pulse rounded-lg"></div>
        <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Appels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Succès</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? `${((stats.success / stats.total) * 100).toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.error}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? `${((stats.error / stats.total) * 100).toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latence Moy.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgLatency)}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Logs d'appels MCP</CardTitle>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Toutes les plateformes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les plateformes</SelectItem>
                {packages?.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {PLATFORM_ICONS[pkg.platform_type] || "🔌"} {pkg.platform_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="success">✅ Succès</SelectItem>
                <SelectItem value="error">❌ Erreur</SelectItem>
              </SelectContent>
            </Select>

            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Dernières 24h</SelectItem>
                <SelectItem value="7d">7 derniers jours</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="all">Tout l'historique</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tableau des logs */}
          {logs && logs.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Outil</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Latence</TableHead>
                    <TableHead>Arguments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const pkg = packages?.find(p => p.id === log.package_id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{PLATFORM_ICONS[pkg?.platform_type || ''] || "🔌"}</span>
                            <span className="text-sm font-medium">{pkg?.platform_type || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{log.tool_name}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {log.latency_ms ? `${log.latency_ms}ms` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate block">
                            {JSON.stringify(log.request_args || {}).substring(0, 50)}...
                          </code>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucun log trouvé</p>
              <p className="text-sm">Aucun appel MCP n'a été effectué pour cette période</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
