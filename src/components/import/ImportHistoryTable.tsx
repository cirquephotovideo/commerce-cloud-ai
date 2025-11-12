import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useRetryImport } from "@/hooks/usePlatformImport";

export function ImportHistoryTable() {
  const { data: history, refetch, isLoading } = useQuery({
    queryKey: ['import-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('import_jobs')
        .select('*, supplier_configurations(supplier_name)')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  const { mutate: retryImport, isPending } = useRetryImport();

  const handleRetry = (jobId: string, supplierId: string) => {
    retryImport({ jobId, supplierId });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique des Imports
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucun historique d'import</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les imports terminés apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="text-right">Erreurs</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.supplier_configurations?.supplier_name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.completed_at && formatDistanceToNow(new Date(job.completed_at), { 
                        locale: fr, 
                        addSuffix: true 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{job.products_imported}</span>
                        <span className="text-muted-foreground">/ {job.progress_total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={job.products_errors > 0 ? "destructive" : "secondary"}>
                        {job.products_errors > 0 && <XCircle className="h-3 w-3 mr-1" />}
                        {job.products_errors}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'completed' ? 'default' : 'destructive'}>
                        {job.status === 'completed' ? '✅ Terminé' : '❌ Échoué'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRetry(job.id, job.supplier_id)}
                        disabled={isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Relancer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
