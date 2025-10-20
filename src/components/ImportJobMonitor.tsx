import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Package, CheckCircle2, XCircle, Clock, TrendingUp, StopCircle } from "lucide-react";
import { toast } from "sonner";

export function ImportJobMonitor() {
  const { data: jobs } = useQuery({
    queryKey: ['active-import-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*, supplier_configurations(supplier_name)')
        .in('status', ['queued', 'processing'])
        .order('started_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 2000,
  });

  if (!jobs || jobs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Imports en cours ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map(job => {
          const percentage = job.progress_total > 0 
            ? Math.round((job.progress_current / job.progress_total) * 100)
            : 0;

          return (
            <div key={job.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {job.supplier_configurations?.supplier_name || 'Import'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={job.status === 'queued' ? 'secondary' : 'default'}>
                    {job.status === 'queued' ? 'En attente' : 'En cours'}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      await supabase
                        .from('import_jobs')
                        .update({ 
                          status: 'failed',
                          error_message: 'Arrêté manuellement par l\'utilisateur',
                          completed_at: new Date().toISOString()
                        })
                        .eq('id', job.id);
                      
                      toast.success('Import arrêté');
                    }}
                  >
                    <StopCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <Progress value={percentage} className="h-2" />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{job.progress_current} / {job.progress_total}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {job.products_imported}
                  </span>
                  {job.products_errors > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-600" />
                      {job.products_errors}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(job.started_at), { locale: fr, addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
