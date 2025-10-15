import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export function EmailPollMonitoring() {
  const { data: pollLogs, refetch } = useQuery({
    queryKey: ['email-poll-logs'],
    queryFn: async () => {
      // Get latest poll log per supplier
      const { data, error } = await supabase
        .from('email_poll_logs')
        .select(`
          *,
          supplier_configurations(supplier_name, connection_config)
        `)
        .order('poll_time', { ascending: false });

      if (error) throw error;

      // Group by supplier_id and keep only latest
      const latestBySupplier = new Map();
      data?.forEach(log => {
        if (!latestBySupplier.has(log.supplier_id) || 
            new Date(log.poll_time) > new Date(latestBySupplier.get(log.supplier_id).poll_time)) {
          latestBySupplier.set(log.supplier_id, log);
        }
      });

      return Array.from(latestBySupplier.values());
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const handleManualPoll = async () => {
    const loadingToast = toast.loading("Déclenchement de la vérification...");
    
    try {
      const { error } = await supabase.functions.invoke('email-imap-scheduler');
      
      toast.dismiss(loadingToast);
      
      if (error) throw error;
      
      toast.success("Vérification déclenchée! Les résultats apparaîtront dans quelques instants.");
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Manual poll error:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Succès</Badge>;
      case 'no_new_emails':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Aucun nouveau</Badge>;
      case 'auth_failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Auth échouée</Badge>;
      case 'connection_error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erreur connexion</Badge>;
      case 'processing_error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Erreur traitement</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Vérifications automatiques toutes les 15 minutes
        </p>
        <Button variant="outline" size="sm" onClick={handleManualPoll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Vérifier maintenant
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Emails trouvés</TableHead>
            <TableHead>Emails traités</TableHead>
            <TableHead>Dernière vérification</TableHead>
            <TableHead>Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pollLogs?.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">
                {log.supplier_configurations?.supplier_name || 'Inconnu'}
              </TableCell>
              <TableCell>
                {getStatusBadge(log.status)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{log.emails_found || 0}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="default">{log.emails_processed || 0}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(log.poll_time).toLocaleString('fr-FR')}
              </TableCell>
              <TableCell className="text-sm text-red-600">
                {log.error_message && (
                  <span className="truncate max-w-xs block" title={log.error_message}>
                    {log.error_message}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!pollLogs?.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Aucune vérification effectuée pour le moment
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
