import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface PlatformImportProgressProps {
  platformId: string;
  jobId: string | null;
  onComplete?: () => void;
}

export const PlatformImportProgress = ({ platformId, jobId, onComplete }: PlatformImportProgressProps) => {
  const [logs, setLogs] = useState<any[]>([]);

  // Fetch job progress
  const { data: job } = useQuery({
    queryKey: ['import-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
    refetchInterval: 1000, // Refresh every second
  });

  // Fetch real logs from import_logs table
  const { data: fetchedLogs } = useQuery({
    queryKey: ['import-logs', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId,
  });

  // Initialize logs from fetched data
  useEffect(() => {
    if (fetchedLogs) {
      setLogs(fetchedLogs);
    }
  }, [fetchedLogs]);

  // Subscribe to realtime updates for new logs
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`import-logs-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'import_logs',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          console.log('New log received:', payload.new);
          setLogs((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // Nettoyer le job quand il est terminé
  useEffect(() => {
    if (job && (job.status === 'completed' || job.status === 'failed') && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [job?.status, onComplete]);

  if (!job) return null;

  const percentage = job.progress_total > 0 
    ? Math.round((job.progress_current / job.progress_total) * 100)
    : 0;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing';

  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Import en cours</h4>
            {isProcessing && <Badge variant="default">En cours</Badge>}
            {isCompleted && <Badge variant="default" className="bg-green-600">Terminé</Badge>}
            {isFailed && <Badge variant="destructive">Échoué</Badge>}
          </div>
          {job.started_at && (
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(job.started_at), { locale: fr, addSuffix: true })}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {job.progress_current} / {job.progress_total} produits
            </span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-3" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <div>
              <div className="font-medium">{job.products_imported}</div>
              <div className="text-muted-foreground text-xs">Importés</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <div>
              <div className="font-medium">{job.products_matched || 0}</div>
              <div className="text-muted-foreground text-xs">Matchés</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <div>
              <div className="font-medium">{job.products_errors}</div>
              <div className="text-muted-foreground text-xs">Erreurs</div>
            </div>
          </div>
        </div>

        {/* Live logs */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Logs en temps réel
          </h5>
          <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">En attente des logs...</div>
            ) : (
              logs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`${
                    log.level === 'error' ? 'text-red-600' : 
                    log.level === 'warn' ? 'text-yellow-600' : 
                    'text-muted-foreground'
                  }`}
                >
                  [{new Date(log.created_at).toLocaleTimeString()}] [{log.step}] {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error message if failed */}
        {isFailed && job.error_message && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm">
            <div className="font-medium text-destructive mb-1">Erreur</div>
            <div className="text-muted-foreground">{job.error_message}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
