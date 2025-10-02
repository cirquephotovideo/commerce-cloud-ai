import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PricingCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    features: any;
    display_order: number;
  };
  billingInterval: "monthly" | "yearly";
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  currentPlanId?: string | null;
  plans?: any[];
  onSelectPlan: (plan: any) => void;
  disabled?: boolean;
}

export const PricingCard = ({
  plan,
  billingInterval,
  isPopular = false,
  isCurrentPlan = false,
  currentPlanId = null,
  plans = [],
  onSelectPlan,
  disabled = false,
}: PricingCardProps) => {
  const price = billingInterval === "monthly" ? plan.price_monthly : plan.price_yearly;
  const displayPrice = price === 0 ? "Sur devis" : `${price}€`;

  const getButtonText = () => {
    if (isCurrentPlan) return "Plan actuel";
    if (!currentPlanId) return "Choisir ce plan";
    
    const currentPlan = plans.find(p => p.id === currentPlanId);
    if (!currentPlan) return "Choisir ce plan";
    
    return plan.display_order > currentPlan.display_order 
      ? "Passer au plan supérieur" 
      : "Passer au plan inférieur";
  };

  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""} ${isCurrentPlan ? "border-accent border-2" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
          Le plus populaire
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent">
          Votre plan actuel
        </Badge>
      )}
      <CardHeader className="text-center pt-6">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{displayPrice}</span>
          {price > 0 && (
            <span className="text-muted-foreground">
              {billingInterval === "monthly" ? "/mois" : "/an"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {Array.isArray(plan.features) && plan.features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onSelectPlan(plan)}
          disabled={isCurrentPlan || disabled}
          className="w-full"
          variant={isPopular ? "default" : "outline"}
        >
          {getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
};
