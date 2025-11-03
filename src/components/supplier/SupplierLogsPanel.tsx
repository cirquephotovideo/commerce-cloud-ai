import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type LogEntry = {
  id: string;
  type: 'error' | 'success' | 'warning' | 'info';
  icon: React.ReactNode;
  message: string;
  timestamp: Date;
  details?: string;
};

export function SupplierLogsPanel() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['supplier-logs'],
    queryFn: async () => {
      const logs: LogEntry[] = [];

      // Fetch recent enrichment errors
      const { data: enrichmentErrors } = await supabase
        .from('supplier_products')
        .select('id, product_name, last_updated, supplier_id, supplier_configurations(supplier_name)')
        .eq('enrichment_status', 'failed')
        .order('last_updated', { ascending: false })
        .limit(10);

      enrichmentErrors?.forEach(error => {
        logs.push({
          id: `enrich-${error.id}`,
          type: 'error',
          icon: <AlertCircle className="h-4 w-4" />,
          message: `Erreur enrichissement: ${error.product_name}`,
          timestamp: new Date(error.last_updated),
          details: 'Enrichissement échoué'
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
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {logs && logs.length > 0 ? (
              logs.map((log) => (
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
