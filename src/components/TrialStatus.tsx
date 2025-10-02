import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, Clock } from "lucide-react";

export const TrialStatus = () => {
  const { isTrial, trialDaysRemaining, subscriptionEnd } = useSubscription();
  const navigate = useNavigate();

  if (!isTrial || !trialDaysRemaining) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">
                🎉 Essai gratuit actif - {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''} restant{trialDaysRemaining > 1 ? 's' : ''}
              </p>
              <p className="text-xs sm:text-sm opacity-90">
                Profitez de toutes les fonctionnalités du plan Starter
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => navigate('/pricing')}
            className="bg-white text-purple-600 hover:bg-white/90 flex-shrink-0"
          >
            <Clock className="h-4 w-4 mr-2" />
            Passer à un plan payant
          </Button>
        </div>
      </div>
    </div>
  );
};
