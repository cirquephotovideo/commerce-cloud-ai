import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign } from "lucide-react";
import { extractAnalysisData } from "@/lib/analysisDataExtractors";

interface SellingPriceSectionProps {
  analysis: any;
}

export const SellingPriceSection = ({ analysis }: SellingPriceSectionProps) => {
  const { productPrice, estimatedPrice, productMargin } = extractAnalysisData(analysis);
  
  const marketAvgPrice = analysis?.analysis_result?.pricing?.market_average;
  const competitorMinPrice = analysis?.analysis_result?.pricing?.competitor_min;
  const competitorMaxPrice = analysis?.analysis_result?.pricing?.competitor_max;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Prix de Vente Recommandé
        </CardTitle>
        <CardDescription>
          Analyse des prix et marges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Prix estimé IA</div>
            <div className="text-2xl font-bold">{estimatedPrice || 'N/A'}</div>
          </div>
          
          {marketAvgPrice && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Prix moyen marché</div>
              <div className="text-2xl font-bold">{marketAvgPrice}</div>
            </div>
          )}
        </div>

        {(competitorMinPrice || competitorMaxPrice) && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Fourchette concurrents</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{competitorMinPrice || 'N/A'}</Badge>
              <span className="text-muted-foreground">-</span>
              <Badge variant="outline">{competitorMaxPrice || 'N/A'}</Badge>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Marge actuelle</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {productMargin ? `${productMargin}%` : 'N/A'}
              </span>
              {productMargin && parseFloat(productMargin) > 0 && (
                <Badge variant="default" className="bg-green-600">
                  {parseFloat(productMargin) >= 30 ? '🟢 Excellente' : 
                   parseFloat(productMargin) >= 20 ? '🟡 Bonne' : '🔴 Faible'}
                </Badge>
              )}
            </div>
          </div>

          {productPrice !== 'N/A' && estimatedPrice && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bénéfice net estimé</span>
              <span className="font-medium">
                {(parseFloat(estimatedPrice) - parseFloat(productPrice)).toFixed(2)}€
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
