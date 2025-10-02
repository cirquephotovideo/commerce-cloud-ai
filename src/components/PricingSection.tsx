import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PricingCard } from "./PricingCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: any;
  display_order: number;
}

export const PricingSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      // Filter out the Super Admin plan from public display
      const filteredPlans = (data || []).filter(plan => plan.name !== "Super Admin");
      setPlans(filteredPlans);
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-24 px-4 bg-card/30">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 px-4 bg-card/30 relative overflow-hidden" id="pricing">
      <div className="absolute inset-0 bg-[var(--gradient-hero)] opacity-30 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            {t("pricing.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            {t("pricing.subtitle")}
          </p>
          
          <div className="inline-flex items-center gap-2 bg-muted/50 p-1 rounded-lg backdrop-blur-sm">
            <Button
              variant={billingInterval === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingInterval("monthly")}
            >
              {t("pricing.monthly")}
            </Button>
            <Button
              variant={billingInterval === "yearly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingInterval("yearly")}
            >
              {t("pricing.yearly")}
              <span className="ml-2 text-xs bg-primary/20 px-2 py-0.5 rounded">
                {t("pricing.save")} 20%
              </span>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              className="animate-fade-in hover-scale"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <PricingCard
                plan={plan}
                isPopular={index === 1}
                billingInterval={billingInterval}
                onSelectPlan={() => navigate("/pricing")}
              />
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("pricing.trial")} • Sans engagement • Annulation en 1 clic
          </p>
        </div>
      </div>
    </section>
  );
};
