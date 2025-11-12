import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";

export const ImportFlowChart = () => {
  const { data: flowData } = useQuery({
    queryKey: ['import-flow-chart'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .rpc('get_import_flow_by_minute', { p_user_id: user.id });

      if (error) {
        console.error('Error fetching import flow:', error);
        return [];
      }

      return data || [];
    },
    refetchInterval: 10000,
  });

  const avgProductsPerMinute = flowData && flowData.length > 0
    ? Math.round(
        flowData.reduce((sum: number, item: any) => sum + item.products_count, 0) / flowData.length
      )
    : 0;

  const chartData = flowData?.map((item: any) => ({
    time: new Date(item.minute).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    produits: item.products_count,
  })) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Flux d'Imports en Temps Réel
            </CardTitle>
            <CardDescription>
              Produits importés par minute (dernière heure)
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{avgProductsPerMinute}</div>
            <p className="text-sm text-muted-foreground">prod/min (moy.)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="produits" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
