import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAmazonLinksAnalytics } from "@/hooks/useAmazonLinksAnalytics";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AmazonLinksFilters } from "./AmazonLinksFilters";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function AmazonLinksAnalytics() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const { data: analyticsData, isLoading } = useAmazonLinksAnalytics(period);

  // Calculate statistics
  const todayCount = analyticsData?.find(item => {
    const itemDate = new Date(item.date);
    const today = new Date();
    return itemDate.toDateString() === today.toDateString();
  })?.links_created || 0;

  const weekCount = analyticsData?.slice(0, 7).reduce((sum, item) => sum + item.links_created, 0) || 0;
  const monthCount = analyticsData?.slice(0, 30).reduce((sum, item) => sum + item.links_created, 0) || 0;
  const totalCount = analyticsData?.[0]?.cumulative || 0;

  // Calculate distribution
  const automaticTotal = analyticsData?.reduce((sum, item) => sum + item.automatic_count, 0) || 0;
  const manualTotal = analyticsData?.reduce((sum, item) => sum + item.manual_count, 0) || 0;

  const distributionData = [
    { type: 'Automatique', count: automaticTotal },
    { type: 'Manuel', count: manualTotal }
  ];

  // Format dates for display
  const chartData = analyticsData?.map(item => ({
    ...item,
    dateFormatted: format(new Date(item.date), 'dd MMM', { locale: fr })
  })) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Analytiques des Liens Amazon</CardTitle>
        </CardHeader>
        <CardContent>
          <AmazonLinksFilters period={period} setPeriod={setPeriod} />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{todayCount}</div>
            <div className="text-sm text-muted-foreground">Aujourd'hui</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{weekCount}</div>
            <div className="text-sm text-muted-foreground">Cette Semaine</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{monthCount}</div>
            <div className="text-sm text-muted-foreground">Ce Mois</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{totalCount}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📈 Évolution des Liens Amazon</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Chargement...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="links_created" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Liens créés"
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    name="Cumulatif"
                    dot={{ fill: 'hsl(var(--accent))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Distribution par Type de Lien</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Chargement...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="type" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
