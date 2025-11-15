import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Sparkles, RefreshCw, Store, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface MultiSupplierPricingDashboardProps {
  analysisId: string;
}

export const MultiSupplierPricingDashboard = ({ analysisId }: MultiSupplierPricingDashboardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);

  // Récupérer les variants de prix
  const { data: priceVariants, isLoading } = useQuery({
    queryKey: ['supplier-price-variants', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_price_variants')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('purchase_price', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Mutation pour enrichir un variant
  const enrichVariant = useMutation({
    mutationFn: async (variantId: string) => {
      const { data, error } = await supabase.functions.invoke('enrich-market-pricing', {
        body: { variant_id: variantId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-price-variants', analysisId] });
      toast({
        title: "✅ Prix marché enrichi",
        description: "Les données de prix ont été mises à jour"
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur enrichissement",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Enrichir tous les variants
  const enrichAllVariants = async () => {
    if (!priceVariants || priceVariants.length === 0) return;
    
    setIsEnrichingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-market-pricing', {
        body: { 
          batch_mode: true,
          analysis_id: analysisId 
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['supplier-price-variants', analysisId] });
      toast({
        title: "✅ Enrichissement massif terminé",
        description: `${data.enriched_count}/${data.total_count} prix enrichis`
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur enrichissement massif",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsEnrichingAll(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!priceVariants || priceVariants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Tarification Multi-Fournisseurs
          </CardTitle>
          <CardDescription>
            Aucun prix fournisseur disponible pour ce produit
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const bestVariant = priceVariants[0]; // Déjà trié par prix croissant
  const hasMarketPricing = priceVariants.some(v => v.market_price);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Tarification Multi-Fournisseurs
            </CardTitle>
            <CardDescription>
              Comparaison prix d'achat, prix marché et marges suggérées
            </CardDescription>
          </div>
          <Button
            onClick={enrichAllVariants}
            disabled={isEnrichingAll}
            variant="outline"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isEnrichingAll ? "Enrichissement..." : "Enrichir Tout"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {priceVariants.map((variant, index) => {
            const isBest = variant.id === bestVariant.id;
            const hasMarket = variant.market_price !== null;
            const margin = variant.suggested_margin_percent || 0;
            const marginAmount = variant.suggested_selling_price && variant.purchase_price
              ? variant.suggested_selling_price - variant.purchase_price
              : 0;

            return (
              <div
                key={variant.id}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  isBest
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {isBest && (
                  <Badge className="absolute -top-3 left-4 bg-primary">
                    ⭐ MEILLEUR PRIX
                  </Badge>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  {/* Fournisseur */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Fournisseur</div>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">Fournisseur #{variant.supplier_id?.slice(0, 8)}</span>
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      Prix Variant
                    </Badge>
                  </div>

                  {/* Prix d'achat */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Prix d'achat</div>
                    <div className="text-2xl font-bold text-foreground">
                      {variant.purchase_price?.toFixed(2)} €
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock: {variant.stock_quantity || 0}
                    </div>
                  </div>

                  {/* Prix marché */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Prix marché</div>
                    {hasMarket ? (
                      <>
                        <div className="text-xl font-semibold text-blue-600">
                          {variant.market_price?.toFixed(2)} €
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {variant.market_price_source || 'Web search'}
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className="text-sm text-muted-foreground">Non enrichi</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => enrichVariant.mutate(variant.id)}
                          disabled={enrichVariant.isPending}
                          className="mt-1"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Enrichir
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Prix vente suggéré */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Prix vente suggéré</div>
                    {variant.suggested_selling_price ? (
                      <>
                        <div className="text-xl font-bold text-green-600">
                          {variant.suggested_selling_price?.toFixed(2)} €
                        </div>
                        <div className="text-xs text-muted-foreground">
                          +{marginAmount.toFixed(2)} € marge
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">-</div>
                    )}
                  </div>

                  {/* Compétitivité */}
                  <div className="text-center">
                    {variant.price_competitiveness && (
                      <div className="space-y-2">
                        <Badge
                          variant={
                            variant.price_competitiveness === 'excellent' ? 'default' :
                            variant.price_competitiveness === 'good' ? 'secondary' :
                            variant.price_competitiveness === 'average' ? 'outline' :
                            'destructive'
                          }
                        >
                          {variant.price_competitiveness === 'excellent' && <TrendingUp className="w-3 h-3 mr-1" />}
                          {variant.price_competitiveness === 'poor' && <TrendingDown className="w-3 h-3 mr-1" />}
                          {variant.price_competitiveness.toUpperCase()}
                        </Badge>
                        {margin > 0 && (
                          <div className="text-sm font-semibold text-foreground">
                            Marge: {margin.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Statut enrichissement */}
                {variant.enrichment_status === 'enriching' && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Enrichissement en cours...
                  </div>
                )}
                {variant.enrichment_status === 'failed' && (
                  <div className="mt-2 text-xs text-destructive">
                    ⚠️ {variant.enrichment_error || 'Échec enrichissement'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!hasMarketPricing && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              💡 Cliquez sur "Enrichir Tout" pour obtenir les prix marché et calculer les marges optimales via Ollama web search
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
