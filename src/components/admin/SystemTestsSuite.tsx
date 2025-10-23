import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, CheckCircle2, XCircle, Clock, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  suite: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  health_score: number;
  duration: number;
}

export const SystemTestsSuite = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('run-system-tests', {
        body: { suites: ['edgeFunctions', 'businessLogic', 'userFlows'] }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);
      setProgress(100);

      toast({
        title: "Tests terminés",
        description: `Score de santé: ${data.summary.health_score}%`,
      });
    } catch (error) {
      console.error('Error running tests:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exécuter les tests",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'skip':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      skip: 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const filterResultsBySuite = (suite: string) => {
    return results.filter(r => r.suite === suite);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Tests Système
              </CardTitle>
              <CardDescription>
                Exécutez et surveillez les tests automatiques de l'application
              </CardDescription>
            </div>
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isRunning ? 'Tests en cours...' : 'Lancer tous les tests'}
            </Button>
          </div>
        </CardHeader>
        {isRunning && (
          <CardContent>
            <Progress value={progress} className="w-full" />
          </CardContent>
        )}
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Global</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getHealthScoreColor(summary.health_score)}`}>
                {summary.health_score}%
              </div>
              <p className="text-xs text-muted-foreground">
                Santé du système
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Réussis</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{summary.passed}</div>
              <p className="text-xs text-muted-foreground">
                sur {summary.total} tests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Échecs</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
              <p className="text-xs text-muted-foreground">
                nécessitent attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Durée</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary.duration / 1000).toFixed(1)}s</div>
              <p className="text-xs text-muted-foreground">
                temps d'exécution
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats des Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edgeFunctions">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="edgeFunctions">
                  Edge Functions ({filterResultsBySuite('edgeFunctions').length})
                </TabsTrigger>
                <TabsTrigger value="businessLogic">
                  Logique Métier ({filterResultsBySuite('businessLogic').length})
                </TabsTrigger>
                <TabsTrigger value="userFlows">
                  Flux Utilisateurs ({filterResultsBySuite('userFlows').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edgeFunctions" className="space-y-2 mt-4">
                {filterResultsBySuite('edgeFunctions').map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="font-medium">{result.name}</p>
                        {result.error && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="businessLogic" className="space-y-2 mt-4">
                {filterResultsBySuite('businessLogic').map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="font-medium">{result.name}</p>
                        {result.error && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="userFlows" className="space-y-2 mt-4">
                {filterResultsBySuite('userFlows').map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <p className="font-medium">{result.name}</p>
                        {result.error && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
