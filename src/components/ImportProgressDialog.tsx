import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ImportProgressDialogProps {
  open: boolean;
  progress: {
    total: number;
    processed: number;
    success: number;
    skipped: number;
    errors: number;
    current_operation: string;
    status?: string;
  };
  processingLogs?: any[];
}

export const ImportProgressDialog = ({ open, progress, processingLogs }: ImportProgressDialogProps) => {
  const [isManuallyClosing, setIsManuallyClosing] = useState(false);
  
  const percentage = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  const isFinished = progress.status === 'completed' || progress.status === 'failed';
  const hasNoProducts = progress.success === 0 && progress.processed > 0;

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

  const handleClose = () => {
    setIsManuallyClosing(true);
    // Trigger parent close if needed
  };

  return (
    <Dialog open={open && !isManuallyClosing}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => {
        // Prevent closing by clicking outside if job not finished or no products
        if (!isFinished || hasNoProducts) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle>
            {isFinished ? (progress.status === 'completed' ? 'Import terminé' : 'Import échoué') : 'Import en cours...'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isFinished 
              ? 'Résultats de l\'import fournisseur' 
              : 'Suivi de l\'import fournisseur en temps réel'}
          </p>
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
          {!isFinished && (
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                {progress.current_operation || 'Traitement en cours...'}
              </p>
            </div>
          )}

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
          {hasNoProducts && isFinished && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">⚠️ Aucun produit importé</p>
              <p className="text-xs text-muted-foreground mt-1">
                Le fichier a été traité mais aucun produit valide n'a été trouvé. 
                Causes possibles:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-1">
                <li>Mapping des colonnes incorrect</li>
                <li>Format de fichier non conforme</li>
                <li>Données manquantes (références, noms de produits)</li>
                <li>Valeurs "NC" ou vides sur toutes les lignes</li>
              </ul>
            </div>
          )}

          {/* Download logs button */}
          {(progress.errors > 0 || progress.skipped > 0 || hasNoProducts) && processingLogs && (
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

          {/* Close button for finished imports */}
          {isFinished && (
            <Button 
              variant="default"
              size="sm"
              className="w-full"
              onClick={handleClose}
            >
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};