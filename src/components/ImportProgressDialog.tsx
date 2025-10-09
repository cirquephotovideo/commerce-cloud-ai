import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

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
}

export const ImportProgressDialog = ({ open, progress }: ImportProgressDialogProps) => {
  const percentage = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import en cours...</DialogTitle>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};