import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Clock, Zap } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface GeminiUsage {
  id: string;
  user_id: string;
  request_type: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  question: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface UsageStats {
  totalRequests: number;
  totalCost: number;
  avgTokensInput: number;
  avgTokensOutput: number;
  avgExecutionTime: number;
  successRate: number;
}

const AdminGeminiUsage = () => {
  const { toast } = useToast();
  const [usage, setUsage] = useState<GeminiUsage[]>([]);
  const [stats, setStats] = useState<UsageStats>({
    totalRequests: 0,
    totalCost: 0,
    avgTokensInput: 0,
    avgTokensOutput: 0,
    avgExecutionTime: 0,
    successRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemini_usage_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setUsage(data || []);
      
      // Calculer les stats
      if (data && data.length > 0) {
        const totalRequests = data.length;
        const totalCost = data.reduce((sum, u) => sum + (u.cost_usd || 0), 0);
        const avgTokensInput = data.reduce((sum, u) => sum + (u.tokens_input || 0), 0) / totalRequests;
        const avgTokensOutput = data.reduce((sum, u) => sum + (u.tokens_output || 0), 0) / totalRequests;
        const avgExecutionTime = data.reduce((sum, u) => sum + (u.execution_time_ms || 0), 0) / totalRequests;
        const successCount = data.filter(u => u.success).length;
        const successRate = (successCount / totalRequests) * 100;

        setStats({
          totalRequests,
          totalCost,
          avgTokensInput: Math.round(avgTokensInput),
          avgTokensOutput: Math.round(avgTokensOutput),
          avgExecutionTime: Math.round(avgExecutionTime),
          successRate: Math.round(successRate),
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données d'usage",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Préparer les données pour les graphiques
  const dailyData = usage.reduce((acc, item) => {
    const date = new Date(item.created_at).toLocaleDateString('fr-FR');
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.requests += 1;
      existing.cost += item.cost_usd || 0;
      existing.tokens += (item.tokens_input || 0) + (item.tokens_output || 0);
    } else {
      acc.push({
        date,
        requests: 1,
        cost: item.cost_usd || 0,
        tokens: (item.tokens_input || 0) + (item.tokens_output || 0),
      });
    }
    return acc;
  }, [] as any[]).slice(0, 30).reverse();

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-primary" />
          Coûts API Gemini RAG
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitoring des coûts et de l'utilisation de l'API Gemini pour le RAG
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Requêtes Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Derniers 100 appels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Coût Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taux de Succès
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requêtes réussies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Temps Moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgExecutionTime}ms</div>
            <p className="text-xs text-muted-foreground mt-1">
              Par requête
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">Requêtes</TabsTrigger>
          <TabsTrigger value="cost">Coûts</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Évolution des Requêtes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" name="Requêtes" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Évolution des Coûts (USD)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" name="Coût USD" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consommation de Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="tokens" stroke="hsl(var(--primary))" name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Historique détaillé */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Requêtes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {usage.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between border-b pb-2 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={item.success ? "default" : "destructive"}>
                      {item.request_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  {item.question && (
                    <p className="text-sm text-muted-foreground truncate">
                      {item.question}
                    </p>
                  )}
                  {item.error_message && (
                    <p className="text-xs text-destructive mt-1">
                      ❌ {item.error_message}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-sm font-medium">
                    ${(item.cost_usd || 0).toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.tokens_input + item.tokens_output} tokens
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGeminiUsage;
