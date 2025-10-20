import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Package, CheckCircle2, XCircle, Clock, TrendingUp, StopCircle, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportJob {
  id: string;
  supplier_id: string;
  status: string;
  progress_current: number;
  progress_total: number;
  products_imported: number;
  products_errors: number;
  started_at: string;
  supplier_configurations?: {
    supplier_name: string;
  };
}

export function LiveImportProgress() {
  const [recentProducts, setRecentProducts] = useState<string[]>([]);

  const { data: jobs, refetch } = useQuery({
    queryKey: ['active-import-jobs-live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*, supplier_configurations(supplier_name)')
        .in('status', ['queued', 'processing'])
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data as ImportJob[];
    },
    refetchInterval: 2000,
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('live-import-progress')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'import_jobs'
      }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Calculate stats
  const calculateStats = (job: ImportJob) => {
    const percentage = job.progress_total > 0 
      ? Math.round((job.progress_current / job.progress_total) * 100)
      : 0;

    const elapsedMs = new Date().getTime() - new Date(job.started_at).getTime();
    const elapsedMin = elapsedMs / 1000 / 60;
    
    const speed = elapsedMin > 0 ? Math.round(job.progress_current / elapsedMin) : 0;
    
    const remainingItems = job.progress_total - job.progress_current;
    const etaMin = speed > 0 ? Math.round(remainingItems / speed) : 0;
    
    let eta = '';
    if (etaMin < 1) eta = '< 1 min';
    else if (etaMin < 60) eta = `${etaMin} min`;
    else eta = `${Math.round(etaMin / 60)}h ${etaMin % 60}min`;

    return { percentage, speed, eta, elapsedMin };
  };

  const handleStop = async (jobId: string) => {
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'failed',
        error_message: 'Arrêté manuellement par l\'utilisateur',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    toast.success('Import arrêté');
  };

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucun import en cours</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les imports apparaîtront ici en temps réel
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map(job => {
        const { percentage, speed, eta } = calculateStats(job);
        const hasErrors = job.products_errors > 0;
        const isStuck = job.status === 'processing' && speed === 0;

        return (
          <Card key={job.id} className="relative overflow-hidden">
            {/* Gradient de fond animé pour les imports actifs */}
            {job.status === 'processing' && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
            )}
            
            <CardHeader className="relative pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {job.supplier_configurations?.supplier_name || 'Import'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={job.status === 'queued' ? 'secondary' : 'default'}
                    className="animate-pulse"
                  >
                    {job.status === 'queued' ? '⏳ En attente' : '⚡ En cours'}
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleStop(job.id)}
                  >
                    <StopCircle className="h-3 w-3 mr-1" />
                    Arrêter
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="relative space-y-4">
              {/* Barre de progression avec gradient */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{percentage}% complété</span>
                  <span className="text-muted-foreground">
                    {job.progress_current} / {job.progress_total}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-3 bg-secondary"
                />
              </div>

              {/* Statistiques en temps réel */}
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="flex flex-col p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">Importés</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {job.products_imported}
                  </div>
                </div>

                {hasErrors && (
                  <div className="flex flex-col p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400 mb-1">
                      <XCircle className="h-4 w-4" />
                      <span className="font-semibold">Erreurs</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {job.products_errors}
                    </div>
                  </div>
                )}

                <div className="flex flex-col p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                    <Zap className="h-4 w-4" />
                    <span className="font-semibold">Vitesse</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {speed}
                    <span className="text-xs ml-1">prod/min</span>
                  </div>
                </div>

                <div className="flex flex-col p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold">ETA</span>
                  </div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {eta}
                  </div>
                </div>
              </div>

              {/* Alerte si import bloqué */}
              {isStuck && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    ⚠️ Import semble bloqué (vitesse = 0). Vérifiez les logs.
                  </AlertDescription>
                </Alert>
              )}

              {/* Métadonnées */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Démarré {formatDistanceToNow(new Date(job.started_at), { locale: fr, addSuffix: true })}
                </span>
                <span className="text-muted-foreground">
                  ID: {job.id.slice(0, 8)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
