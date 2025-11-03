import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, PlayCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PLATFORM_ICONS: Record<string, string> = {
  odoo: "🏢",
  prestashop: "🛒",
  "amazon-seller-mcp": "📦",
};

// Test tools pour chaque plateforme
const TEST_TOOLS: Record<string, { tool: string; args: any }> = {
  odoo: { tool: 'list_products', args: { limit: 1 } },
  prestashop: { tool: 'get_products', args: { limit: 1 } },
  'amazon-seller-mcp': { tool: 'search_catalog', args: { keywords: 'test', limit: 1 } },
};

interface TestResult {
  platformId: string;
  status: 'success' | 'error';
  latency: number;
  message: string;
  timestamp: Date;
}

export const MCPConnectionTests = () => {
  const { toast } = useToast();
  const [testingPlatforms, setTestingPlatforms] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TestResult[]>>({});

  // Fetch des configurations actives
  const { data: platforms, isLoading } = useQuery({
    queryKey: ['mcp-platforms-test'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const testConnection = async (platform: any) => {
    const platformId = platform.id;
    setTestingPlatforms(prev => new Set(prev).add(platformId));

    const startTime = Date.now();
    
    try {
      // Récupérer le test tool approprié
      const testConfig = TEST_TOOLS[platform.platform_type];
      
      if (!testConfig) {
        throw new Error(`Aucun outil de test disponible pour ${platform.platform_type}`);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Appeler l'edge function mcp-proxy
      const { data, error } = await supabase.functions.invoke('mcp-proxy', {
        body: {
          packageId: platformId,
          toolName: testConfig.tool,
          args: testConfig.args,
        },
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      });

      const latency = Date.now() - startTime;

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erreur inconnue');
      }

      // Enregistrer le résultat de succès
      const result: TestResult = {
        platformId,
        status: 'success',
        latency,
        message: `Connexion réussie - ${testConfig.tool}`,
        timestamp: new Date(),
      };

      setTestResults(prev => ({
        ...prev,
        [platformId]: [result, ...(prev[platformId] || [])].slice(0, 5)
      }));

      toast({
        title: "✅ Test réussi",
        description: `${PLATFORM_ICONS[platform.platform_type]} ${platform.platform_type} répond en ${latency}ms`,
      });

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Enregistrer le résultat d'erreur
      const result: TestResult = {
        platformId,
        status: 'error',
        latency,
        message: error.message || 'Erreur de connexion',
        timestamp: new Date(),
      };

      setTestResults(prev => ({
        ...prev,
        [platformId]: [result, ...(prev[platformId] || [])].slice(0, 5)
      }));

      toast({
        title: "❌ Test échoué",
        description: error.message || 'Impossible de se connecter à la plateforme',
        variant: "destructive",
      });
    } finally {
      setTestingPlatforms(prev => {
        const newSet = new Set(prev);
        newSet.delete(platformId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">Aucune plateforme active</p>
          <p className="text-sm text-muted-foreground">Activez des plateformes pour les tester</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Tests de connexion</h3>
        <p className="text-sm text-muted-foreground">
          Testez la connectivité de vos plateformes MCP en exécutant un appel simple
        </p>
      </div>

      {platforms.map(platform => {
        const isTesting = testingPlatforms.has(platform.id);
        const history = testResults[platform.id] || [];
        const lastTest = history[0];

        return (
          <Card key={platform.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PLATFORM_ICONS[platform.platform_type] || "🔌"}</span>
                  <div>
                    <CardTitle className="text-lg capitalize">
                      {platform.platform_type.replace('_', ' ')}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {platform.platform_url || 'URL non configurée'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => testConnection(platform)}
                  disabled={isTesting}
                  size="sm"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Test en cours...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Tester
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Résultat du dernier test */}
              {lastTest && (
                <div className="mb-4 p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {lastTest.status === 'success' ? (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Connexion réussie
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Échec
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(lastTest.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{lastTest.latency}ms</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{lastTest.message}</p>
                </div>
              )}

              {/* Historique des 5 derniers tests */}
              {history.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Historique des tests</h4>
                  <div className="space-y-2">
                    {history.slice(1).map((test, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          {test.status === 'success' ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          <span className="text-muted-foreground">
                            {format(test.timestamp, 'dd/MM HH:mm', { locale: fr })}
                          </span>
                        </div>
                        <span className="font-medium">{test.latency}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!lastTest && !isTesting && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Aucun test effectué
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
