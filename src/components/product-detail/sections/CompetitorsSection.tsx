import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, RefreshCw, TrendingUp } from "lucide-react";

interface CompetitorsSectionProps {
  analysis: any;
}

export const CompetitorsSection = ({ analysis }: CompetitorsSectionProps) => {
  const competitors = analysis?.analysis_result?.competitors || [];
  const estimatedPrice = analysis?.analysis_result?.pricing?.recommended_price;

  if (competitors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Comparaison Concurrents
          </CardTitle>
          <CardDescription>
            Aucune donnée concurrent disponible
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sortedCompetitors = [...competitors].sort((a, b) => 
    parseFloat(a.price) - parseFloat(b.price)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Comparaison Concurrents ({competitors.length} détectés)
        </CardTitle>
        <CardDescription>
          Analyse des prix et positionnement concurrentiel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sortedCompetitors.map((competitor: any, index: number) => {
            const priceDiff = estimatedPrice ? 
              ((parseFloat(competitor.price) - parseFloat(estimatedPrice)) / parseFloat(estimatedPrice) * 100).toFixed(0) : null;

            return (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 flex-1">
                  <div className="font-medium">{competitor.name || `Concurrent ${index + 1}`}</div>
                  {competitor.stock && (
                    <Badge variant={competitor.stock === 'in_stock' ? 'default' : 'outline'} className="text-xs">
                      {competitor.stock === 'in_stock' ? '✅' : '⚠️'}
                    </Badge>
                  )}
                  {competitor.rating && (
                    <div className="text-sm text-muted-foreground">
                      {competitor.rating}★
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {competitor.price}€
                  </Badge>
                  {priceDiff && (
                    <Badge variant={parseFloat(priceDiff) > 0 ? 'default' : 'destructive'} className="text-xs">
                      {parseFloat(priceDiff) > 0 ? '↓' : '↑'}{Math.abs(parseFloat(priceDiff))}%
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Positionnement */}
        {estimatedPrice && (
          <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Votre position</span>
              <Badge variant="default" className="gap-1">
                🥇 Meilleur prix
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Recommandation: Prix compétitif, possibilité d'augmenter de 5€
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <TrendingUp className="h-3 w-3" />
            Voir graphique
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Actualiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
