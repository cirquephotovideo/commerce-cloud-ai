import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionLimits {
  product_analyses: number;
  google_shopping_searches: number;
  price_alerts: number;
  image_optimizations: number;
}

interface SubscriptionContextType {
  subscribed: boolean;
  planId: string | null;
  planName: string | null;
  productId: string | null;
  subscriptionEnd: string | null;
  limits: SubscriptionLimits | null;
  isLoading: boolean;
  isAdmin: boolean;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  checkSubscription: () => Promise<void>;
  canUseFeature: (feature: keyof SubscriptionLimits) => Promise<boolean>;
  getUsageCount: (feature: keyof SubscriptionLimits) => Promise<number>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscribed, setSubscribed] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const { toast } = useToast();

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubscribed(false);
        setLimits(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;

      setSubscribed(data.subscribed || false);
      setPlanId(data.plan_id);
      setProductId(data.product_id);
      setSubscriptionEnd(data.subscription_end);
      setLimits(data.limits);
      setIsAdmin(data.is_admin || false);
      setIsTrial(data.is_trial || false);
      setTrialDaysRemaining(data.trial_days_remaining || null);
      setTrialExpired(data.trial_expired || false);

      // Get plan name if we have a plan_id
      if (data.plan_id) {
        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("name")
          .eq("id", data.plan_id)
          .single();
        
        if (planData) {
          setPlanName(planData.name);
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUsageCount = async (feature: keyof SubscriptionLimits): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("usage_tracking")
        .select("usage_count")
        .eq("user_id", user.id)
        .eq("feature_type", feature)
        .gte("period_start", startOfMonth.toISOString())
        .lte("period_end", endOfMonth.toISOString())
        .maybeSingle();

      if (error) throw error;
      return data?.usage_count || 0;
    } catch (error) {
      console.error("Error getting usage count:", error);
      return 0;
    }
  };

  const canUseFeature = async (feature: keyof SubscriptionLimits): Promise<boolean> => {
    // Super admins have unlimited access
    if (isAdmin) return true;

    if (!limits) {
      toast({
        title: "Abonnement requis",
        description: "Veuillez souscrire à un plan pour utiliser cette fonctionnalité.",
        variant: "destructive",
      });
      return false;
    }

    const limit = limits[feature];
    if (limit === -1) return true; // Unlimited

    const usage = await getUsageCount(feature);
    
    if (usage >= limit) {
      toast({
        title: "Limite atteinte",
        description: `Vous avez atteint votre limite mensuelle de ${limit} ${feature}. Mettez à niveau votre plan pour continuer.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  useEffect(() => {
    checkSubscription();

    // Auto-refresh every 60 seconds
    const interval = setInterval(checkSubscription, 60000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const refreshSubscription = async () => {
    await checkSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscribed,
        planId,
        planName,
        productId,
        subscriptionEnd,
        limits,
        isLoading,
        isAdmin,
        isTrial,
        trialDaysRemaining,
        trialExpired,
        checkSubscription,
        canUseFeature,
        getUsageCount,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};
