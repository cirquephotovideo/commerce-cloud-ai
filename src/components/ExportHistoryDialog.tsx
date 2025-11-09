import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface ExportHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId?: string;
}

interface ExportLog {
  id: string;
  user_id: string;
  products_count: number;
  success_count: number;
  error_count: number;
  export_details: {
    results?: Array<{
      analysis_id: string;
      product_name: string;
      success: boolean;
      error?: string;
      platform?: string;
      action?: string;
    }>;
  } | null;
  created_at: string;
}

interface FlattenedExport {
  id: string;
  created_at: string;
  platform_type: string;
  status: 'success' | 'failed';
  error_message: string | null;
  analysis_id: string;
  product_name: string;
  action: string;
}

export const ExportHistoryDialog = ({ open, onOpenChange, analysisId }: ExportHistoryDialogProps) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: exportHistory, isLoading, refetch } = useQuery<FlattenedExport[]>({
    queryKey: ['export-history', analysisId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('export_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;

      // Cast to proper type
      const logs = (data || []) as ExportLog[];

      // Flatten export_details.results into individual rows
      const flattenedData: FlattenedExport[] = logs.flatMap(log => {
        const results = log.export_details?.results || [];
        return results.map(result => ({
          id: `${log.id}-${result.analysis_id}`,
          created_at: log.created_at,
          platform_type: result.platform || 'odoo',
          status: (result.success ? 'success' : 'failed') as 'success' | 'failed',
          error_message: result.error || null,
          analysis_id: result.analysis_id,
          product_name: result.product_name,
          action: result.action || 'created',
        }));
      });

      // Filter by analysisId if provided
      if (analysisId) {
        return flattenedData.filter(exp => exp.analysis_id === analysisId);
      }

      return flattenedData;
    },
    enabled: open,
  });

  // Realtime subscription for new exports
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('export-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'export_logs',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, refetch]);

  const retryExport = async (exportId: string, platform: string, analysisId: string) => {
    setRetryingId(exportId);
    try {
      const { data, error } = await supabase.functions.invoke('export-single-product', {
        body: {
          analysis_id: analysisId,
          platform: platform,
        }
      });

      if (error) throw error;

      toast.success(`Export relancé avec succès`);
      refetch();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique des Exports</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plateforme</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Erreur</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportHistory?.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="text-sm">
                    {new Date(exp.created_at).toLocaleString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {exp.platform_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={exp.status === 'success' ? 'default' : 'destructive'}>
                      {exp.status === 'success' ? '✓ Succès' : '✗ Échec'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {exp.error_message || '-'}
                  </TableCell>
                  <TableCell>
                    {exp.status === 'failed' && exp.analysis_id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => retryExport(exp.id, exp.platform_type, exp.analysis_id)}
                        disabled={retryingId === exp.id}
                      >
                        {retryingId === exp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Réessayer
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!exportHistory || exportHistory.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun export trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};