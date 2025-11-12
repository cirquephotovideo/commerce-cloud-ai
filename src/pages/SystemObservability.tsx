import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useQueueMetrics } from "@/hooks/useQueueMetrics";
import { Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Unlock, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SystemObservability = () => {
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth();
  const { data: queueData, isLoading: queueLoading } = useQueueMetrics();
  const { toast } = useToast();
  const [isUnlocking, setIsUnlocking] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const handleUnlockStuck = async () => {
    setIsUnlocking(true);
    try {
      const { error } = await supabase.functions.invoke('unlock-all-stuck-products');
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Stuck products unlocked successfully",
      });
      refetchHealth();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  const successRate = queueData ? 
    (queueData.completed24h + queueData.failed24h > 0 ? 
      ((queueData.completed24h / (queueData.completed24h + queueData.failed24h)) * 100).toFixed(1) : 
      '100.0') : '0';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Observability</h1>
          <p className="text-muted-foreground">Real-time monitoring of enrichment queue and system health</p>
        </div>
        <Button onClick={() => refetchHealth()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Overall Health Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-muted">
              {healthData && getStatusIcon(healthData.status)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {healthLoading ? 'Loading...' : healthData?.status.toUpperCase()}
              </h2>
              <p className="text-sm text-muted-foreground">
                Last checked: {healthData?.timestamp ? formatDistanceToNow(new Date(healthData.timestamp), { addSuffix: true }) : 'Never'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleUnlockStuck} 
              disabled={isUnlocking || !queueData?.stuck}
              variant="outline"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Unlock Stuck ({queueData?.stuck || 0})
            </Button>
          </div>
        </div>

        {/* Recommendations */}
        {healthData?.recommendations && healthData.recommendations.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="font-semibold">Recommendations:</h3>
            {healthData.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue Metrics - Live */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Enrichment Queue (Live)
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-blue-500">{queueData?.pending || 0}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-green-500">{queueData?.processing || 0}</div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-emerald-500">{queueData?.completed24h || 0}</div>
              <div className="text-sm text-muted-foreground">Completed (24h)</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-red-500">{queueData?.failed24h || 0}</div>
              <div className="text-sm text-muted-foreground">Failed (24h)</div>
            </div>
          </div>

          {queueData && queueData.stuck > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-destructive">{queueData.stuck}</div>
                  <div className="text-sm text-muted-foreground">Stuck Products (>10 min)</div>
                </div>
                <Button onClick={handleUnlockStuck} disabled={isUnlocking} variant="destructive" size="sm">
                  Unlock Now
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* System Status */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">System Health Checks</h3>
          
          <div className="space-y-3">
            {/* Database */}
            {healthData?.checks.database && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthData.checks.database.status)}
                  <div>
                    <div className="font-medium">Database</div>
                    <div className="text-xs text-muted-foreground">
                      Latency: {healthData.checks.database.latency}ms
                    </div>
                  </div>
                </div>
                <Badge variant={healthData.checks.database.status === 'ok' ? 'default' : 'destructive'}>
                  {healthData.checks.database.status}
                </Badge>
              </div>
            )}

            {/* Queue */}
            {healthData?.checks.queue && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthData.checks.queue.status)}
                  <div>
                    <div className="font-medium">Queue Health</div>
                    <div className="text-xs text-muted-foreground">
                      Success Rate: {healthData.checks.queue.successRate}
                    </div>
                  </div>
                </div>
                <Badge variant={healthData.checks.queue.status === 'ok' ? 'default' : 'destructive'}>
                  {healthData.checks.queue.status}
                </Badge>
              </div>
            )}

            {/* Amazon Credentials */}
            {healthData?.checks.amazon_credentials && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthData.checks.amazon_credentials.status)}
                  <div>
                    <div className="font-medium">Amazon Credentials</div>
                    <div className="text-xs text-muted-foreground">
                      {healthData.checks.amazon_credentials.days_until_expiry !== undefined 
                        ? `Expires in ${healthData.checks.amazon_credentials.days_until_expiry} days`
                        : healthData.checks.amazon_credentials.message}
                    </div>
                  </div>
                </div>
                <Badge variant={healthData.checks.amazon_credentials.status === 'ok' ? 'default' : 'destructive'}>
                  {healthData.checks.amazon_credentials.status}
                </Badge>
              </div>
            )}

            {/* Recent Errors */}
            {healthData?.checks.recent_errors && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthData.checks.recent_errors.status)}
                  <div>
                    <div className="font-medium">Recent Errors</div>
                    <div className="text-xs text-muted-foreground">
                      {healthData.checks.recent_errors.count} in last {healthData.checks.recent_errors.timeframe}
                    </div>
                  </div>
                </div>
                <Badge variant={healthData.checks.recent_errors.status === 'ok' ? 'default' : 'destructive'}>
                  {healthData.checks.recent_errors.status}
                </Badge>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Success Rate Visualization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Success Rate (24h)</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-6xl font-bold ${parseFloat(successRate) >= 90 ? 'text-green-500' : 'text-yellow-500'}`}>
              {successRate}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {queueData?.completed24h || 0} completed / {(queueData?.completed24h || 0) + (queueData?.failed24h || 0)} total
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SystemObservability;