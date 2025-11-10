import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { EnrichmentProgress, EnrichmentStep } from "@/hooks/useEnrichmentProgress";

interface EnrichmentProgressDialogProps {
  open: boolean;
  progress: EnrichmentProgress;
}

export const EnrichmentProgressDialog = ({ open, progress }: EnrichmentProgressDialogProps) => {
  
  const getStepIcon = (status: EnrichmentStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'skipped':
        return <span className="w-5 h-5 text-gray-400">⊘</span>;
      default:
        return <Clock className="w-5 h-5 text-gray-300" />;
    }
  };

  const getStepBadge = (status: EnrichmentStep['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Terminé</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      case 'processing':
        return <Badge variant="secondary">En cours...</Badge>;
      case 'skipped':
        return <Badge variant="outline">Ignoré</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  };

  const getDuration = (step: EnrichmentStep): string => {
    if (!step.startTime) return '';
    const end = step.endTime || Date.now();
    const duration = Math.round((end - step.startTime) / 1000);
    return duration > 0 ? `(${duration}s)` : '';
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress.isEnriching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enrichissement en cours
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Enrichissement terminé
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression globale</span>
              <span className="font-semibold">{progress.overall}%</span>
            </div>
            <Progress value={progress.overall} className="h-3" />
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {progress.steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  step.status === 'processing' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                    : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStepIcon(step.status)}
                  <div className="flex-1">
                    <div className="font-medium">{step.name}</div>
                    {step.details && (
                      <div className="text-sm text-muted-foreground mt-1">{step.details}</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{getDuration(step)}</span>
                  {getStepBadge(step.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
