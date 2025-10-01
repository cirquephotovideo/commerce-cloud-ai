import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PricingCardProps {
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
  billingInterval: "monthly" | "yearly";
  onSelect: () => void;
}

export const PricingCard = ({
  name,
  description,
  priceMonthly,
  priceYearly,
  features,
  isPopular,
  isCurrent,
  billingInterval,
  onSelect,
}: PricingCardProps) => {
  const { t } = useTranslation();
  const price = billingInterval === "monthly" ? priceMonthly : priceYearly;
  const displayPrice = price === 0 ? t("pricing.contactUs") : `${price}€`;

  return (
    <Card className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""} ${isCurrent ? "border-accent border-2" : ""}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
          {t("pricing.mostPopular")}
        </Badge>
      )}
      {isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent">
          {t("pricing.currentPlan")}
        </Badge>
      )}
      <CardHeader className="text-center pt-6">
        <CardTitle className="text-2xl">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{displayPrice}</span>
          {price > 0 && (
            <span className="text-muted-foreground">
              {billingInterval === "monthly" ? t("pricing.perMonth") : t("pricing.perYear")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          size="lg"
          onClick={onSelect}
          disabled={isCurrent}
          variant={isPopular ? "default" : "outline"}
        >
          {isCurrent ? t("pricing.currentPlan") : price === 0 ? t("pricing.contactUs") : t("pricing.getStarted")}
        </Button>
      </CardFooter>
    </Card>
  );
};
