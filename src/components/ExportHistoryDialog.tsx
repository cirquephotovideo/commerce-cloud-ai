import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ExportHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId?: string;
}

export const ExportHistoryDialog = ({ open, onOpenChange, analysisId }: ExportHistoryDialogProps) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: exportHistory, isLoading, refetch } = useQuery({
    queryKey: ['export-history', analysisId],
    queryFn: async () => {
      let query = supabase
        .from('export_history')
        .select('*')
        .order('exported_at', { ascending: false });
      
      if (analysisId) {
        query = query.eq('analysis_id', analysisId);
      }
      
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

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
                    {new Date(exp.exported_at).toLocaleString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{exp.platform_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      exp.status === 'success' ? 'default' :
                      exp.status === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {exp.status === 'success' ? '✓ Succès' :
                       exp.status === 'failed' ? '✗ Échec' :
                       '⚠ Partiel'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {exp.error_message || '-'}
                  </TableCell>
                  <TableCell>
                    {exp.status === 'failed' && (
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