import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { PricingCard } from "@/components/PricingCard";
import { SubscriptionChangeModal } from "@/components/SubscriptionChangeModal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: any;
  display_order: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
  stripe_product_id?: string;
}

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { planId: currentPlanId, refreshSubscription, isTrial } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [changeType, setChangeType] = useState<"upgrade" | "downgrade" | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .neq("name", "Super Admin")
        .order("display_order");

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Si l'utilisateur a déjà un plan actif
    if (currentPlanId && !isTrial) {
      const currentPlan = plans.find(p => p.id === currentPlanId);
      if (currentPlan) {
        const isUpgrade = plan.display_order > currentPlan.display_order;
        setChangeType(isUpgrade ? "upgrade" : "downgrade");
        setSelectedPlan(plan);
        setChangeModalOpen(true);
        return;
      }
    }

    // Nouvel abonnement ou conversion depuis l'essai
    await processCheckout(plan);
  };

  const processCheckout = async (plan: Plan) => {
    setIsProcessing(true);
    try {
      const priceId = billingInterval === "monthly" 
        ? plan.stripe_price_id_monthly 
        : plan.stripe_price_id_yearly;

      if (!priceId) {
        toast({
          title: "Erreur",
          description: "Prix non disponible pour cette période de facturation",
          variant: "destructive",
        });
        return;
      }

      const functionName = isTrial ? "subscribe-from-trial" : "create-checkout";
      const body = isTrial 
        ? { planId: plan.id, billingInterval }
        : { priceId, billingInterval };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmChange = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { 
          newPlanId: selectedPlan.id,
          billingInterval 
        },
      });

      if (error) throw error;

      toast({
        title: "Plan mis à jour",
        description: "Votre abonnement a été modifié avec succès",
      });

      setChangeModalOpen(false);
      await refreshSubscription();
    } catch (error) {
      console.error("Erreur lors du changement de plan:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier votre abonnement",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === currentPlanId);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <section className="py-12 sm:py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Choisissez votre plan
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              Des solutions adaptées à tous vos besoins
            </p>
            
            <div className="inline-flex items-center gap-4 bg-muted p-1 rounded-lg">
              <Button
                variant={billingInterval === "monthly" ? "default" : "ghost"}
                onClick={() => setBillingInterval("monthly")}
                size="sm"
              >
                Mensuel
              </Button>
              <Button
                variant={billingInterval === "yearly" ? "default" : "ghost"}
                onClick={() => setBillingInterval("yearly")}
                size="sm"
              >
                Annuel
                <span className="ml-2 text-xs bg-primary/20 px-2 py-0.5 rounded">
                  Économisez 17%
                </span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingInterval={billingInterval}
                isPopular={plan.name === "Premium"}
                isCurrentPlan={currentPlanId === plan.id}
                currentPlanId={currentPlanId}
                plans={plans}
                onSelectPlan={handleSelectPlan}
                disabled={isProcessing}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Essai gratuit de 7 jours • Sans engagement • Annulez à tout moment
            </p>
          </div>
        </div>
      </section>

      <SubscriptionChangeModal
        open={changeModalOpen}
        onOpenChange={setChangeModalOpen}
        onConfirm={handleConfirmChange}
        isLoading={isProcessing}
        changeType={changeType}
        currentPlan={currentPlan?.name || ""}
        newPlan={selectedPlan?.name || ""}
        billingInterval={billingInterval === "monthly" ? "Mensuel" : "Annuel"}
      />
    </main>
  );
};

export default Pricing;
