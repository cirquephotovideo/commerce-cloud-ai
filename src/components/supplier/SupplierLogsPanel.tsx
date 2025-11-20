import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

type LogEntry = {
  id: string;
  type: 'error' | 'success' | 'warning' | 'info';
  icon: React.ReactNode;
  message: string;
  timestamp: Date;
  details?: string;
};

export function SupplierLogsPanel() {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'errors' | 'success'>('all');
  
  const { data: logs, isLoading } = useQuery({
    queryKey: ['supplier-logs'],
    queryFn: async () => {
      const logs: LogEntry[] = [];

      // Fetch recent enrichment errors with detailed error messages
      const { data: enrichmentErrors } = await supabase
        .from('supplier_products')
        .select('id, product_name, last_updated, enrichment_error_message, supplier_id, supplier_configurations(supplier_name)')
        .eq('enrichment_status', 'failed')
        .order('last_updated', { ascending: false })
        .limit(10);

      enrichmentErrors?.forEach(error => {
        let errorDetails = 'Enrichissement échoué';
        let errorCode = 'UNKNOWN';
        
        // Parse structured error if available
        if (error.enrichment_error_message) {
          try {
            const parsed = JSON.parse(error.enrichment_error_message);
            errorCode = parsed.code || 'UNKNOWN';
            errorDetails = parsed.message || error.enrichment_error_message;
            
            // Add actionable suggestions
            switch (parsed.code) {
              case 'JSON_PARSE_ERROR':
                errorDetails += ' → L\'IA a retourné une réponse invalide. Réessayez avec un autre modèle.';
                break;
              case 'INCOMPLETE_ANALYSIS':
                errorDetails += ' → Données incomplètes. Vérifiez les informations produit.';
                break;
              case 'AI_CALL_FAILED':
                errorDetails += ` → Erreur ${parsed.provider || 'AI'}. Vérifiez la configuration.`;
                break;
              case 'EMPTY_AI_RESPONSE':
                errorDetails += ' → Réponse vide de l\'IA. Réessayez plus tard.';
                break;
            }
          } catch {
            errorDetails = error.enrichment_error_message;
          }
        }
        
        logs.push({
          id: `enrich-${error.id}`,
          type: 'error',
          icon: <AlertCircle className="h-4 w-4" />,
          message: `[${errorCode}] "${error.product_name}"`,
          timestamp: new Date(error.last_updated),
          details: errorDetails
        });
      });

      // Fetch recent import errors
      const { data: importErrors } = await supabase
        .from('import_errors')
        .select('id, error_type, error_message, created_at, supplier_configurations(supplier_name)')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      importErrors?.forEach(error => {
        logs.push({
          id: `import-${error.id}`,
          type: 'error',
          icon: <AlertCircle className="h-4 w-4" />,
          message: `Erreur import: ${error.error_type}`,
          timestamp: new Date(error.created_at),
          details: error.error_message
        });
      });

      // Fetch recent email polls
      const { data: emailPolls } = await supabase
        .from('email_poll_logs')
        .select('id, status, emails_found, emails_processed, created_at, supplier_configurations(supplier_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      emailPolls?.forEach(poll => {
        logs.push({
          id: `email-${poll.id}`,
          type: poll.status === 'success' ? 'success' : 'error',
          icon: <Mail className="h-4 w-4" />,
          message: `Email traité: ${poll.emails_found} trouvés, ${poll.emails_processed} traités`,
          timestamp: new Date(poll.created_at),
          details: poll.status
        });
      });

      // Fetch recent successful enrichments
      const { data: successfulEnrichments } = await supabase
        .from('enrichment_queue')
        .select('id, completed_at, supplier_products(product_name)')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(5);

      successfulEnrichments?.forEach(enrich => {
        if (enrich.completed_at) {
          logs.push({
            id: `success-${enrich.id}`,
            type: 'success',
            icon: <CheckCircle2 className="h-4 w-4" />,
            message: `Enrichissement terminé`,
            timestamp: new Date(enrich.completed_at),
            details: 'Enrichissement réussi'
          });
        }
      });

      // Sort all logs by timestamp
      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Filtrer les logs selon la sévérité
  const filteredLogs = logs?.filter(log => {
    if (filterSeverity === 'errors') return log.type === 'error';
    if (filterSeverity === 'success') return log.type === 'success';
    return true;
  });

  const errorCount = logs?.filter(l => l.type === 'error').length || 0;
  const successCount = logs?.filter(l => l.type === 'success').length || 0;

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-destructive';
      case 'success': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const getLogBadge = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return <Badge variant="destructive">Erreur</Badge>;
      case 'success': return <Badge className="bg-green-500">Succès</Badge>;
      case 'warning': return <Badge variant="outline" className="border-amber-500 text-amber-500">Attention</Badge>;
      default: return <Badge variant="secondary">Info</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            Chargement des logs...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Logs en Direct
        </CardTitle>
        <CardDescription>
          Activité en temps réel du système (rafraîchissement auto toutes les 5s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtres */}
        <div className="flex gap-2 mb-4">
          <Button 
            size="sm" 
            variant={filterSeverity === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterSeverity('all')}
          >
            Tout ({logs?.length || 0})
          </Button>
          <Button 
            size="sm" 
            variant={filterSeverity === 'errors' ? 'default' : 'outline'}
            onClick={() => setFilterSeverity('errors')}
          >
            🔴 Erreurs ({errorCount})
          </Button>
          <Button 
            size="sm" 
            variant={filterSeverity === 'success' ? 'default' : 'outline'}
            onClick={() => setFilterSeverity('success')}
          >
            ✅ Succès ({successCount})
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {filteredLogs && filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={getLogColor(log.type)}>
                    {log.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{log.message}</p>
                      {getLogBadge(log.type)}
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {log.details}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
