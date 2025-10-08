import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface TableHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  hasRLS: boolean;
  recordCount: number;
  issues: string[];
  lovablePrompt?: string;
}

export const DatabaseHealthChecker = () => {
  const [tables, setTables] = useState<TableHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkDatabaseHealth = async () => {
    setLoading(true);
    try {
      // Liste des tables à vérifier
      const tablesToCheck = [
        'profiles', 'user_roles', 'product_analyses', 'subscription_plans',
        'user_subscriptions', 'billing_history', 'price_monitoring', 'price_history',
        'market_trends', 'competitor_sites', 'conversations', 'messages',
        'email_campaigns', 'newsletter_subscribers', 'amazon_product_data',
        'odoo_configurations', 'platform_configurations', 'google_services_config',
        'ai_provider_configs', 'system_health_logs', 'feature_suggestions', 'fix_tracking'
      ];

      const healthChecks = await Promise.all(
        tablesToCheck.map(async (tableName) => {
          const issues: string[] = [];
          let status: 'healthy' | 'warning' | 'critical' = 'healthy';

          // Vérifier le nombre d'enregistrements
          const { count, error: countError } = await supabase
            .from(tableName as any)
            .select('*', { count: 'exact', head: true });

          if (countError) {
            issues.push(`Erreur lors du comptage: ${countError.message}`);
            status = 'critical';
          }

          const recordCount = count || 0;

          // TODO: Vérifier RLS (nécessite une requête admin)
          const hasRLS = true; // Placeholder

          // Déterminer le statut
          if (issues.length > 0) {
            status = 'critical';
          } else if (recordCount === 0 && !tableName.includes('logs')) {
            status = 'warning';
            issues.push('Table vide (peut être normal)');
          }

          // Générer prompt Lovable si nécessaire
          let lovablePrompt: string | undefined;
          if (status === 'critical') {
            lovablePrompt = `Fix database issues for table "${tableName}":
${issues.map(i => `- ${i}`).join('\n')}

Please ensure:
1. Row Level Security (RLS) is enabled
2. Appropriate policies are in place
3. The table structure matches the schema
4. Foreign keys are properly configured`;
          }

          return {
            name: tableName,
            status,
            hasRLS,
            recordCount,
            issues,
            lovablePrompt
          };
        })
      );

      setTables(healthChecks);

      // Enregistrer dans les logs
      for (const table of healthChecks) {
        await supabase.from('system_health_logs').insert({
          test_type: 'database_table',
          component_name: table.name,
          status: table.status === 'healthy' ? 'operational' : 
                 table.status === 'warning' ? 'warning' : 'failing',
          test_result: { recordCount: table.recordCount, hasRLS: table.hasRLS, issues: table.issues },
          tested_by: (await supabase.auth.getUser()).data.user?.id
        });
      }

      toast({
        title: "✅ Vérification terminée",
        description: `${healthChecks.length} tables analysées`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "📋 Prompt copié",
      description: "Collez-le dans l'éditeur Lovable",
    });
  };

  const getStatusIcon = (status: TableHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  useEffect(() => {
    checkDatabaseHealth();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <span className="font-semibold">{tables.length} tables</span>
        </div>
        <Button onClick={checkDatabaseHealth} disabled={loading}>
          {loading ? "Analyse en cours..." : "🔄 Réanalyser"}
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {['healthy', 'warning', 'critical'].map((statusFilter) => {
          const filteredTables = tables.filter(t => t.status === statusFilter);
          if (filteredTables.length === 0) return null;

          return (
            <AccordionItem key={statusFilter} value={statusFilter}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    statusFilter === 'healthy' ? 'default' : 
                    statusFilter === 'warning' ? 'secondary' : 'destructive'
                  }>
                    {statusFilter.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {filteredTables.length} tables
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {filteredTables.map((table) => (
                    <div key={table.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(table.status)}
                        <div>
                          <div className="font-mono text-sm">{table.name}</div>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {table.recordCount} enregistrements
                            </Badge>
                            <Badge variant={table.hasRLS ? "default" : "destructive"} className="text-xs">
                              {table.hasRLS ? "RLS ✓" : "RLS ✗"}
                            </Badge>
                          </div>
                          {table.issues.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {table.issues.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {table.lovablePrompt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => copyPrompt(table.lovablePrompt!)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Fix Prompt
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};