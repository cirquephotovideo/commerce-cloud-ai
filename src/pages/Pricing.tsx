import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { PricingCard } from "@/components/PricingCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    loadCurrentSubscription();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
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

  const loadCurrentSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("plan_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      if (data) setCurrentPlanId(data.plan_id);
    } catch (error: any) {
      console.error("Error loading subscription:", error);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.price_monthly === 0) {
      toast({
        title: "Contactez-nous",
        description: "Pour le plan Enterprise, veuillez nous contacter directement.",
      });
      return;
    }

    try {
      const priceId = billingInterval === "monthly" 
        ? plan.stripe_price_id_monthly 
        : plan.stripe_price_id_yearly;

      if (!priceId) {
        toast({
          title: "Erreur",
          description: "Configuration du plan non disponible.",
          variant: "destructive",
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentification requise",
          description: "Veuillez vous connecter pour souscrire à un plan.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, billingInterval },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la session de paiement.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <section className="py-12 sm:py-16 md:py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              {t("pricing.title")}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              {t("pricing.subtitle")}
            </p>
            
            <div className="inline-flex items-center gap-4 bg-muted p-1 rounded-lg">
              <Button
                variant={billingInterval === "monthly" ? "default" : "ghost"}
                onClick={() => setBillingInterval("monthly")}
                size="sm"
              >
                {t("pricing.monthly")}
              </Button>
              <Button
                variant={billingInterval === "yearly" ? "default" : "ghost"}
                onClick={() => setBillingInterval("yearly")}
                size="sm"
              >
                {t("pricing.yearly")}
                <span className="ml-2 text-xs bg-primary/20 px-2 py-0.5 rounded">
                  {t("pricing.save")} 17%
                </span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {plans.map((plan, idx) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                description={plan.description || ""}
                priceMonthly={Number(plan.price_monthly)}
                priceYearly={Number(plan.price_yearly)}
                features={Array.isArray(plan.features) ? plan.features : []}
                isPopular={idx === 1}
                isCurrent={plan.id === currentPlanId}
                billingInterval={billingInterval}
                onSelect={() => handleSelectPlan(plan)}
              />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t("pricing.trial")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Pricing;
