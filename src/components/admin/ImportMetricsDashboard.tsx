import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface Metrics {
  imports_per_minute: string;
  avg_chunk_duration_seconds: string;
  error_rate: string;
  total_processed: number;
  total_errors: number;
  active_jobs: number;
  stalled_jobs: number;
  dlq_entries: number;
}

export function ImportMetricsDashboard() {
  const [timeWindow, setTimeWindow] = useState("1 hour");

  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['import-metrics', timeWindow],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('metrics-collector', {
        body: { window: timeWindow }
      });

      if (error) throw error;
      return data as { metrics: Metrics };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const metrics = metricsData?.metrics;

  const statCards = [
    {
      title: "Import Rate",
      value: metrics?.imports_per_minute || "0",
      unit: "imports/min",
      icon: TrendingUp,
      description: "Current import throughput",
      color: "text-primary"
    },
    {
      title: "Avg Duration",
      value: metrics?.avg_chunk_duration_seconds || "0",
      unit: "seconds",
      icon: Clock,
      description: "Average chunk processing time",
      color: "text-blue-500"
    },
    {
      title: "Error Rate",
      value: (parseFloat(metrics?.error_rate || "0") * 100).toFixed(2),
      unit: "%",
      icon: AlertTriangle,
      description: "Failed imports percentage",
      color: parseFloat(metrics?.error_rate || "0") > 0.05 ? "text-destructive" : "text-green-500"
    },
    {
      title: "Active Jobs",
      value: metrics?.active_jobs || 0,
      unit: "jobs",
      icon: Activity,
      description: "Currently processing",
      color: "text-orange-500"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Import Performance Metrics</h2>
          <p className="text-muted-foreground">Real-time monitoring of import operations</p>
        </div>
        
        <Select value={timeWindow} onValueChange={setTimeWindow}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15 minutes">Last 15 min</SelectItem>
            <SelectItem value="1 hour">Last hour</SelectItem>
            <SelectItem value="6 hours">Last 6 hours</SelectItem>
            <SelectItem value="24 hours">Last 24 hours</SelectItem>
            <SelectItem value="7 days">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stat.value}{" "}
                <span className="text-sm text-muted-foreground">{stat.unit}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Processed</CardTitle>
            <CardDescription>Imports in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.total_processed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Errors</CardTitle>
            <CardDescription>Failed imports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {metrics?.total_errors || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stalled Jobs</CardTitle>
            <CardDescription>Processing &gt;10 min</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">
              {metrics?.stalled_jobs || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DLQ Alert */}
      {metrics && metrics.dlq_entries > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Dead Letter Queue Alert
            </CardTitle>
            <CardDescription>
              Failed chunks require manual investigation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.dlq_entries}</div>
                <p className="text-sm text-muted-foreground">chunks in DLQ</p>
              </div>
              <a 
                href="/admin/dlq" 
                className="text-sm text-primary hover:underline"
              >
                View DLQ →
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
