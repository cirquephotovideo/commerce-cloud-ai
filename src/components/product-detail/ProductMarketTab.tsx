import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ProductMonitoringDetail } from "@/components/market/ProductMonitoringDetail";
import { getProductName } from "@/lib/analysisDataExtractors";

interface ProductMarketTabProps {
  analysis: any;
}

export const ProductMarketTab = ({ analysis }: ProductMarketTabProps) => {
  const [priceData, setPriceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const productName = getProductName(analysis);

  const loadPriceData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Utilisateur non connecté");
        return;
      }

      const { data, error } = await supabase
        .from("price_monitoring")
        .select(`
          *,
          competitor_sites (
            site_name,
            site_url
          )
        `)
        .eq("user_id", user.id)
        .ilike("product_name", `%${productName}%`)
        .order("current_price", { ascending: true });

      if (error) throw error;

      setPriceData(data || []);
      
      if (data && data.length > 0) {
        toast.success(`${data.length} offre(s) trouvée(s)`);
      } else {
        toast.info("Aucune offre trouvée pour ce produit");
      }
    } catch (error: any) {
      console.error("Error loading price data:", error);
      toast.error("Erreur lors du chargement des prix");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetail = (product: any) => {
    setSelectedProduct(product);
    setShowDetail(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Surveillance des Prix & Marché
          </CardTitle>
          <CardDescription>
            Comparez les prix et suivez l'évolution du marché pour ce produit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={loadPriceData} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Chargement des données...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Charger les données de prix
              </>
            )}
          </Button>

          {priceData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Meilleur prix trouvé</div>
                  <div className="text-2xl font-bold text-green-600">
                    {priceData[0].current_price}€
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Offres disponibles</div>
                  <div className="text-2xl font-bold">{priceData.length}</div>
                </div>
              </div>

              <div className="space-y-2">
                {priceData.slice(0, 5).map((offer) => (
                  <Card key={offer.id} className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{offer.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {offer.competitor_sites?.site_name || "Site inconnu"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">{offer.current_price}€</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(offer)}
                          >
                            Voir détails
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {priceData.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  Et {priceData.length - 5} autre(s) offre(s)...
                </p>
              )}
            </div>
          )}

          {priceData.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée de prix disponible</p>
              <p className="text-sm mt-2">Cliquez sur le bouton ci-dessus pour charger les données</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductMonitoringDetail
        product={selectedProduct}
        allOffers={priceData}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </div>
  );
};
