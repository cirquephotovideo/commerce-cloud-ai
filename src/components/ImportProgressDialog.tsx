import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImportProgressDialogProps {
  open: boolean;
  progress: {
    total: number;
    processed: number;
    success: number;
    skipped: number;
    errors: number;
    current_operation: string;
  };
  processingLogs?: any[];
}

export const ImportProgressDialog = ({ open, progress, processingLogs }: ImportProgressDialogProps) => {
  const percentage = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  const handleDownloadLogs = () => {
    if (!processingLogs || processingLogs.length === 0) return;
    
    const logs = JSON.stringify(processingLogs, null, 2);
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import en cours...</DialogTitle>
          <p className="text-sm text-muted-foreground">Suivi de l'import fournisseur en temps réel</p>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{progress.processed} / {progress.total}</span>
              <span>{percentage}%</span>
            </div>
            <Progress value={percentage} />
          </div>

          {/* Statut actuel */}
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">
              {progress.current_operation || 'Traitement en cours...'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Card className="p-3">
              <div className="font-bold text-green-600 text-2xl">{progress.success}</div>
              <div className="text-muted-foreground text-xs">Succès</div>
            </Card>
            <Card className="p-3">
              <div className="font-bold text-orange-600 text-2xl">{progress.skipped}</div>
              <div className="text-muted-foreground text-xs">Ignorés</div>
            </Card>
            <Card className="p-3">
              <div className="font-bold text-red-600 text-2xl">{progress.errors}</div>
              <div className="text-muted-foreground text-xs">Erreurs</div>
            </Card>
          </div>

          {/* Warning if 0 products imported */}
          {progress.success === 0 && progress.processed > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">⚠️ Aucun produit importé</p>
              <p className="text-xs text-muted-foreground mt-1">
                Le fichier a été traité mais aucun produit valide n'a été trouvé. 
                Vérifiez le mapping des colonnes ou le format du fichier.
              </p>
            </div>
          )}

          {/* Download logs button */}
          {(progress.errors > 0 || progress.skipped > 0 || (progress.success === 0 && progress.processed > 0)) && processingLogs && (
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={handleDownloadLogs}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger les logs détaillés
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};