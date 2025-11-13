import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Chunk = Database['public']['Tables']['code2asin_import_chunks']['Row'];

interface ChunksProgressProps {
  jobId: string;
  totalRows: number;
}

export function ChunksProgressDashboard({ jobId, totalRows }: ChunksProgressProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    loadChunks();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`chunks-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'code2asin_import_chunks',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log('[CHUNKS-REALTIME] Update:', payload);
          loadChunks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const loadChunks = async () => {
    const { data, error } = await supabase
      .from('code2asin_import_chunks')
      .select('*')
      .eq('job_id', jobId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('Error loading chunks:', error);
      return;
    }

    setChunks(data || []);
  };

  const retryFailedChunks = async () => {
    setIsRetrying(true);
    try {
      const { error } = await supabase.functions.invoke('retry-failed-code2asin-chunks', {
        body: { jobId }
      });

      if (error) throw error;

      toast.success("Relance des chunks échoués en cours...");
      loadChunks();
    } catch (error: any) {
      console.error('Retry error:', error);
      toast.error(error.message || "Erreur lors de la relance");
    } finally {
      setIsRetrying(false);
    }
  };

  const completedChunks = chunks.filter(c => c.status === 'completed').length;
  const failedChunks = chunks.filter(c => c.status === 'failed').length;
  const processingChunks = chunks.filter(c => c.status === 'processing').length;
  const pendingChunks = chunks.filter(c => c.status === 'pending').length;
  
  const totalProcessed = chunks.reduce((sum, c) => sum + (c.processed_rows || 0), 0);
  const overallProgress = totalRows > 0 ? Math.round((totalProcessed / totalRows) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Progression par Chunks</CardTitle>
            <CardDescription>
              {completedChunks}/{chunks.length} chunks terminés • {totalProcessed}/{totalRows} produits
            </CardDescription>
          </div>
          {failedChunks > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={retryFailedChunks}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Relancer les échecs
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Progression globale</span>
              <span className="text-muted-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completedChunks}</div>
              <div className="text-xs text-muted-foreground">Terminés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{processingChunks}</div>
              <div className="text-xs text-muted-foreground">En cours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{pendingChunks}</div>
              <div className="text-xs text-muted-foreground">En attente</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{failedChunks}</div>
              <div className="text-xs text-muted-foreground">Échoués</div>
            </div>
          </div>

          {/* Chunks List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {chunks.map((chunk) => {
              const totalRows = chunk.end_row - chunk.start_row;
              const chunkProgress = totalRows > 0 
                ? Math.round(((chunk.processed_rows || 0) / totalRows) * 100) 
                : 0;

              return (
                <div 
                  key={chunk.id} 
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        Chunk {chunk.chunk_index + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Lignes {chunk.start_row}-{chunk.end_row}
                      </span>
                    </div>
                    {getStatusBadge(chunk.status)}
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {chunk.processed_rows || 0}/{totalRows} produits
                      </span>
                      <span className="font-medium">{chunkProgress}%</span>
                    </div>
                    <Progress 
                      value={chunkProgress} 
                      className="h-2"
                    />
                  </div>

                  {chunk.error_message && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {chunk.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
