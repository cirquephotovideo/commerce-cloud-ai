import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";

interface SubscriptionChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  changeType: "upgrade" | "downgrade" | null;
  currentPlan: string;
  newPlan: string;
  billingInterval: string;
}

export const SubscriptionChangeModal = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  changeType,
  currentPlan,
  newPlan,
  billingInterval,
}: SubscriptionChangeModalProps) => {
  if (!changeType) return null;

  const isUpgrade = changeType === "upgrade";
  const Icon = isUpgrade ? ArrowUpCircle : ArrowDownCircle;
  const title = isUpgrade ? "Confirmer le passage supérieur" : "Confirmer le passage inférieur";
  const actionText = isUpgrade ? "Passer au plan supérieur" : "Passer au plan inférieur";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isUpgrade ? 'bg-green-100 dark:bg-green-900/20' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
              <Icon className={`h-6 w-6 ${isUpgrade ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`} />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Plan actuel :</span>
              <span className="text-sm text-muted-foreground">{currentPlan}</span>
            </div>
            <div className="flex items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">Nouveau plan :</span>
              <span className="text-sm font-semibold">{newPlan} ({billingInterval === "monthly" ? "Mensuel" : "Annuel"})</span>
            </div>

            {isUpgrade ? (
              <p className="text-sm text-muted-foreground pt-2">
                💡 Votre compte sera débité au prorata du temps restant sur votre période actuelle.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground pt-2">
                ℹ️ Le changement prendra effet à la fin de votre période de facturation actuelle.
              </p>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              actionText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
