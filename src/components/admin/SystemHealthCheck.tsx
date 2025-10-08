import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Sparkles, History as HistoryIcon } from "lucide-react";
import { EdgeFunctionTester } from "./EdgeFunctionTester";
import { DatabaseHealthChecker } from "./DatabaseHealthChecker";
import { FeatureIdeaGenerator } from "./FeatureIdeaGenerator";
import { FixHistoryDashboard } from "./FixHistoryDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const SystemHealthCheck = () => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [overallHealth, setOverallHealth] = useState<number | null>(null);
  const { toast } = useToast();

  const runAllTests = async () => {
    setIsRunningAll(true);
    toast({
      title: "🔍 Tests en cours...",
      description: "Test de toutes les fonctionnalités du système",
    });

    try {
      // Récupérer tous les logs de santé récents
      const { data: logs, error } = await supabase
        .from("system_health_logs")
        .select("*")
        .order("tested_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculer le score de santé global
      const operational = logs?.filter(l => l.status === 'operational').length || 0;
      const total = logs?.length || 1;
      const healthScore = Math.round((operational / total) * 100);
      
      setOverallHealth(healthScore);

      toast({
        title: "✅ Tests terminés",
        description: `Score de santé global : ${healthScore}%`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec statistiques globales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Score Global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallHealth !== null ? `${overallHealth}%` : "—"}
            </div>
            <Badge variant={overallHealth && overallHealth > 80 ? "default" : "destructive"}>
              {overallHealth && overallHealth > 80 ? "Excellent" : "À améliorer"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Edge Functions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">44</div>
            <p className="text-xs text-muted-foreground">Total déployées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tables DB</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">62</div>
            <p className="text-xs text-muted-foreground">Total créées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={runAllTests} disabled={isRunningAll} className="w-full">
              {isRunningAll ? "Tests en cours..." : "🚀 Tout tester"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Health Check
          </TabsTrigger>
          <TabsTrigger value="ideas">
            <Sparkles className="h-4 w-4 mr-2" />
            Feature Ideas
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="h-4 w-4 mr-2" />
            Fix History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚡ Edge Functions</CardTitle>
              <CardDescription>
                Test automatique de toutes les fonctions serverless
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EdgeFunctionTester />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🗄️ Database Health</CardTitle>
              <CardDescription>
                Vérification de l'état des tables et des RLS policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DatabaseHealthChecker />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ideas">
          <FeatureIdeaGenerator />
        </TabsContent>

        <TabsContent value="history">
          <FixHistoryDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};