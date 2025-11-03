import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, Zap, AlertTriangle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MCPStats {
  total_calls: number;
  success_rate: number;
  avg_latency: number;
  p95_latency: number;
  calls_by_platform: { platform: string; count: number }[];
  latency_over_time: { hour: string; avg_latency: number }[];
}

export const MCPMonitoringWidget = () => {
  const [stats, setStats] = useState<MCPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unhealthyPlatforms, setUnhealthyPlatforms] = useState<string[]>([]);

  useEffect(() => {
    fetchStats();
    checkHealth();
    
    const interval = setInterval(() => {
      fetchStats();
      checkHealth();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: logs, error } = await supabase
        .from('mcp_call_logs')
        .select('*')
        .gte('created_at', sevenDaysAgo);

      if (error) throw error;

      const totalCalls = logs.length;
      const successCalls = logs.filter(l => l.success).length;
      const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;
      
      const latencies = logs.filter(l => l.latency_ms).map(l => l.latency_ms);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
      
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95Latency = sortedLatencies[p95Index] || 0;

      const platformCounts = logs.reduce((acc, log) => {
        acc[log.package_id] = (acc[log.package_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const callsByPlatform = Object.entries(platformCounts).map(([platform, count]) => ({
        platform,
        count
      }));

      const hourlyLatency = logs.reduce((acc, log) => {
        const hour = new Date(log.created_at).toISOString().slice(0, 13);
        if (!acc[hour]) acc[hour] = { sum: 0, count: 0 };
        acc[hour].sum += log.latency_ms || 0;
        acc[hour].count += 1;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      const latencyOverTime = Object.entries(hourlyLatency)
        .map(([hour, { sum, count }]) => ({
          hour: new Date(hour).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit' }),
          avg_latency: Math.round(sum / count)
        }))
        .slice(-24);

      setStats({
        total_calls: totalCalls,
        success_rate: Math.round(successRate * 10) / 10,
        avg_latency: Math.round(avgLatency),
        p95_latency: Math.round(p95Latency),
        calls_by_platform: callsByPlatform,
        latency_over_time: latencyOverTime
      });
    } catch (error) {
      console.error('Error fetching MCP stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async () => {
    const { data: healthChecks } = await supabase
      .from('mcp_health_checks')
      .select('package_id, is_healthy')
      .eq('is_healthy', false);

    if (healthChecks && healthChecks.length > 0) {
      setUnhealthyPlatforms(healthChecks.map(h => h.package_id));
    } else {
      setUnhealthyPlatforms([]);
    }
  };

  if (loading) return <div>Chargement des statistiques MCP...</div>;

  return (
    <div className="space-y-4">
      {unhealthyPlatforms.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Plateformes indisponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {unhealthyPlatforms.join(', ')} ne réponde(nt) pas.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Appels (7j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_calls || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taux de succès
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.success_rate || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Latence Moy.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_latency || 0}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Latence P95
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.p95_latency || 0}ms</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latence sur 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.latency_over_time || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_latency" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Appels par plateforme</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.calls_by_platform || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
