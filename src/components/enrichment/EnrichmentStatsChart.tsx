import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '@/components/ui/badge';

interface EnrichmentTask {
  enrichment_type: string[];
  status: string;
}

interface EnrichmentStatsChartProps {
  tasks: EnrichmentTask[];
}

const ENRICHMENT_COLORS: Record<string, string> = {
  'amazon': '#f59e0b',
  'images': '#8b5cf6',
  'ai_images': '#8b5cf6',
  'image_search': '#a855f7',
  'competitor_analysis': '#ef4444',
  'seo': '#3b82f6',
  'taxonomy': '#10b981',
  'heygen': '#ec4899',
  'specifications': '#06b6d4',
  'cost_analysis': '#f97316',
  'technical_description': '#6366f1',
  'default': '#6b7280'
};

const ENRICHMENT_LABELS: Record<string, string> = {
  'amazon': 'Amazon',
  'images': 'Images IA',
  'ai_images': 'Images IA',
  'image_search': 'Recherche Images',
  'competitor_analysis': 'Concurrence',
  'seo': 'SEO',
  'taxonomy': 'Catégories',
  'heygen': 'Vidéo',
  'specifications': 'Spécifications',
  'cost_analysis': 'Coûts',
  'technical_description': 'Description Tech',
  'default': 'Autre'
};

export const EnrichmentStatsChart = ({ tasks }: EnrichmentStatsChartProps) => {
  // Calculer les stats par type d'enrichissement
  const statsByType = tasks.reduce((acc, task) => {
    task.enrichment_type.forEach(type => {
      if (!acc[type]) {
        acc[type] = {
          type,
          total: 0,
          completed: 0,
          processing: 0,
          pending: 0,
          failed: 0,
        };
      }
      
      acc[type].total++;
      
      if (task.status === 'completed') acc[type].completed++;
      else if (task.status === 'processing') acc[type].processing++;
      else if (task.status === 'pending') acc[type].pending++;
      else if (task.status === 'failed') acc[type].failed++;
    });
    
    return acc;
  }, {} as Record<string, any>);

  // Convertir en tableau et trier par total
  const chartData = Object.values(statsByType)
    .map((stat: any) => ({
      ...stat,
      name: ENRICHMENT_LABELS[stat.type] || stat.type,
      successRate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
    }))
    .sort((a: any, b: any) => b.total - a.total);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>📊 Statistiques par Type d'Enrichissement</span>
          <Badge variant="outline" className="text-xs">
            {chartData.length} types actifs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--card-foreground))'
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  'completed': '✅ Terminés',
                  'processing': '⚡ En cours',
                  'pending': '⏳ En attente',
                  'failed': '❌ Échoués',
                  'successRate': '📈 Taux de succès'
                };
                return [value + (name === 'successRate' ? '%' : ''), labels[name] || name];
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  'completed': '✅ Terminés',
                  'processing': '⚡ En cours',
                  'pending': '⏳ En attente',
                  'failed': '❌ Échoués'
                };
                return labels[value] || value;
              }}
            />
            <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="processing" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Résumé des meilleurs performers */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {chartData
            .filter((stat: any) => stat.completed > 0)
            .sort((a: any, b: any) => b.successRate - a.successRate)
            .slice(0, 3)
            .map((stat: any) => (
              <div 
                key={stat.type} 
                className="p-4 rounded-lg border bg-gradient-to-br from-green-500/10 to-blue-500/10"
              >
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.name}
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stat.successRate}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.completed}/{stat.total} réussis
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
};
