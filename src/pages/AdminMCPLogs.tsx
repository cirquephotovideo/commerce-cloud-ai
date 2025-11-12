import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Zap, Database } from "lucide-react";

export default function AdminMCPLogs() {
  const { data: logs } = useQuery({
    queryKey: ["mcp-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery({
    queryKey: ["mcp-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_call_logs")
        .select("success, cache_hit, latency_ms");
      
      if (error) throw error;
      
      const total = data.length;
      const successful = data.filter(l => l.success).length;
      const cacheHits = data.filter(l => l.cache_hit).length;
      const avgLatency = total > 0 
        ? data.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / total 
        : 0;
      
      return {
        total,
        successful,
        failed: total - successful,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : "0",
        cacheHitRate: total > 0 ? ((cacheHits / total) * 100).toFixed(1) : "0",
        avgLatency: avgLatency.toFixed(0),
      };
    },
    refetchInterval: 5000,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📊 Logs MCP</h1>
        <p className="text-muted-foreground">Monitoring des appels aux plateformes MCP</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appels</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Succès</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.successful || 0} succès / {stats?.failed || 0} échecs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cacheHitRate || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latence Moyenne</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgLatency || 0}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dernière Mise à Jour</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">Temps réel</div>
            <p className="text-xs text-muted-foreground">Refresh: 5s</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers Appels MCP (100 derniers)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b pb-2 hover:bg-accent/50 p-2 rounded">
                  <div className="flex items-center gap-3 flex-1">
                    {log.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.platform_type || 'N/A'}
                      </Badge>
                      <span className="font-mono text-sm text-muted-foreground">
                        {log.tool_name || log.package_id}
                      </span>
                    </div>
                    {!log.success && log.error_message && (
                      <span className="text-xs text-red-500 truncate max-w-xs">
                        {log.error_message}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {log.cache_hit && (
                      <Badge variant="secondary" className="text-xs">
                        Cache Hit
                      </Badge>
                    )}
                    <span className={`text-sm font-medium ${
                      log.latency_ms < 100 ? 'text-green-500' : 
                      log.latency_ms < 500 ? 'text-yellow-500' : 
                      'text-red-500'
                    }`}>
                      {log.latency_ms}ms
                    </span>
                    <span className="text-xs text-muted-foreground min-w-[120px] text-right">
                      {new Date(log.created_at).toLocaleString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Aucun log MCP disponible
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
