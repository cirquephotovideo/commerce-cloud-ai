import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ExportJob {
  id: string;
  status: string;
  progress_current: number;
  progress_total: number;
  products_exported: number;
  file_url: string | null;
  file_name: string;
  created_at: string;
}

export function LiveExportProgress() {
  const { data: exports, refetch } = useQuery({
    queryKey: ['code2asin-exports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('code2asin_export_jobs')
        .select('*')
        .in('status', ['queued', 'processing', 'completed'])
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as ExportJob[];
    },
    refetchInterval: 2000
  });

  useEffect(() => {
    const channel = supabase
      .channel('code2asin-export-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'code2asin_export_jobs'
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  if (!exports || exports.length === 0) return null;

  return (
    <div className="space-y-3">
      {exports.map((exp) => {
        const percentage = exp.progress_total > 0 
          ? (exp.progress_current / exp.progress_total) * 100 
          : 0;
        
        const isCompleted = exp.status === 'completed';
        const isProcessing = exp.status === 'processing' || exp.status === 'queued';

        return (
          <Card key={exp.id} className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="font-medium">
                    {isCompleted ? '✅ Export terminé' : '⏳ Export en cours'}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {exp.progress_current} / {exp.progress_total}
                </span>
              </div>
              
              {isProcessing && (
                <>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(1)}% complété
                  </p>
                </>
              )}

              {isCompleted && exp.file_url && (
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(exp.file_url!, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger le fichier CSV
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
