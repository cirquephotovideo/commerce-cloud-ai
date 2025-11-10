import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface QualityMetrics {
  total_analyses: number;
  complete_analyses: number;
  incomplete_analyses: number;
  avg_completeness_score: number;
  most_missing_fields: Array<{ field: string; count: number }>;
  avg_enrichment_time_seconds: number;
  provider_success_rates: Record<string, { total: number; successful: number; rate: number }>;
  quality_by_category: Record<string, { count: number; avg_score: number }>;
  recent_failures: Array<{
    id: string;
    product_name: string;
    missing_fields: string[];
    created_at: string;
  }>;
}

export function AnalysisQualityDashboard() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    fetchQualityMetrics();
  }, [selectedDays]);

  const fetchQualityMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analysis-quality-report', {
        body: { days: selectedDays }
      });

      if (error) throw error;
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching quality metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erreur</AlertTitle>
        <AlertDescription>
          Impossible de charger les métriques de qualité.
        </AlertDescription>
      </Alert>
    );
  }

  const completionRate = metrics.total_analyses > 0 
    ? Math.round((metrics.complete_analyses / metrics.total_analyses) * 100) 
    : 0;

  const providerData = Object.entries(metrics.provider_success_rates).map(([provider, stats]) => ({
    name: provider,
    rate: stats.rate,
    total: stats.total,
    successful: stats.successful
  }));

  const categoryData = Object.entries(metrics.quality_by_category).map(([category, stats]) => ({
    name: category.length > 20 ? category.substring(0, 20) + '...' : category,
    score: stats.avg_score,
    count: stats.count
  }));

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de Bord Qualité</h1>
          <p className="text-muted-foreground">Monitoring de la qualité des analyses produits</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedDays === days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {days} jours
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_analyses}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% complètes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Moyen</CardTitle>
            {metrics.avg_completeness_score >= 80 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avg_completeness_score}%</div>
            <p className="text-xs text-muted-foreground">
              Complétude moyenne
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps Moyen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avg_enrichment_time_seconds}s</div>
            <p className="text-xs text-muted-foreground">
              Par enrichissement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses Incomplètes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.incomplete_analyses}</div>
            <p className="text-xs text-muted-foreground">
              Nécessitent attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="failures">Échecs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Taux de Complétion</CardTitle>
                <CardDescription>Distribution complètes vs incomplètes</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Complètes', value: metrics.complete_analyses },
                        { name: 'Incomplètes', value: metrics.incomplete_analyses }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--destructive))" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Champs Manquants</CardTitle>
                <CardDescription>Top 10 des champs les plus souvent absents</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.most_missing_fields.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="field" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tick={{ fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance par Provider</CardTitle>
              <CardDescription>Taux de succès des différents providers IA</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="rate" name="Taux de succès (%)" fill="hsl(var(--primary))" />
                  <Bar dataKey="total" name="Total analyses" fill="hsl(var(--secondary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {providerData.map((provider, index) => (
              <Card key={provider.name}>
                <CardHeader>
                  <CardTitle className="text-sm">{provider.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{provider.rate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {provider.successful}/{provider.total} succès
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Qualité par Catégorie</CardTitle>
              <CardDescription>Score moyen de complétude par catégorie produit</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    tick={{ fill: 'hsl(var(--foreground))' }}
                  />
                  <YAxis tick={{ fill: 'hsl(var(--foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="score" name="Score moyen" fill="hsl(var(--primary))" />
                  <Bar dataKey="count" name="Nombre d'analyses" fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyses Récentes en Échec</CardTitle>
              <CardDescription>Les 20 dernières analyses incomplètes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recent_failures.map((failure) => (
                  <div 
                    key={failure.id}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{failure.product_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(failure.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {failure.missing_fields.length} champs manquants
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {failure.missing_fields.slice(0, 5).map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {failure.missing_fields.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{failure.missing_fields.length - 5} autres
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {metrics.recent_failures.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>Aucune analyse en échec récente !</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
