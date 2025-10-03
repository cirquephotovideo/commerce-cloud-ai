import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, RefreshCw, ExternalLink, TrendingUp, Ruler, Image as ImageIcon } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ProductAmazonTabProps {
  analysis: any;
}

export const ProductAmazonTab = ({ analysis }: ProductAmazonTabProps) => {
  const { toast } = useToast();
  const [amazonData, setAmazonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAmazonData = async () => {
    try {
      const { data, error } = await supabase
        .from('amazon_product_data')
        .select('*')
        .eq('analysis_id', analysis.id)
        .maybeSingle();

      if (error) throw error;
      setAmazonData(data);
    } catch (error: any) {
      console.error('Error loading Amazon data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAmazonData();
  }, [analysis.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-product-enrichment', {
        body: { analysis_id: analysis.id }
      });

      if (error) throw error;

      toast({
        title: "✅ Données actualisées",
        description: "Les informations Amazon ont été mises à jour",
      });

      await loadAmazonData();
    } catch (error: any) {
      // Si 403, demander de vérifier la configuration AWS
      if (error?.status === 403) {
        toast({
          title: "⚠️ Erreur de configuration AWS",
          description: "Vérifiez vos credentials AWS dans Admin → API Keys",
          variant: "destructive",
        });
      }
      // Si 404, afficher un message neutre (produit introuvable)
      else if (error?.status === 404) {
        toast({
          title: "ℹ️ Produit introuvable",
          description: "Ce produit n'a pas été trouvé sur Amazon.",
        });
      } else {
        toast({
          title: "❌ Erreur",
          description: error.message || "Impossible de récupérer les données Amazon.",
          variant: "destructive",
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!amazonData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune donnée Amazon</CardTitle>
          <CardDescription>
            Ce produit n'a pas encore été enrichi avec les données Amazon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Cliquez sur le bouton "Enrichir avec Amazon Seller" dans l'onglet Aperçu pour synchroniser les données.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasImages = amazonData.images && Array.isArray(amazonData.images) && amazonData.images.length > 0;
  const hasSalesRank = amazonData.sales_rank && Array.isArray(amazonData.sales_rank) && amazonData.sales_rank.length > 0;
  const hasFeatures = amazonData.features && Array.isArray(amazonData.features) && amazonData.features.length > 0;

  return (
    <div className="space-y-6">
      {/* Header avec bouton refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Données Amazon Seller</h3>
          <p className="text-sm text-muted-foreground">
            Dernière synchronisation : {new Date(amazonData.last_synced_at).toLocaleString('fr-FR')}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">ASIN</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded">{amazonData.asin}</code>
                <a 
                  href={`https://www.amazon.fr/dp/${amazonData.asin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Voir sur Amazon
                </a>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">EAN</span>
              <p className="text-sm mt-1">{amazonData.ean || 'N/A'}</p>
            </div>
          </div>

          {amazonData.title && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Titre Amazon</span>
              <p className="text-sm mt-1">{amazonData.title}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {amazonData.brand && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Marque</span>
                <p className="text-sm mt-1">{amazonData.brand}</p>
              </div>
            )}
            {amazonData.manufacturer && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Fabricant</span>
                <p className="text-sm mt-1">{amazonData.manufacturer}</p>
              </div>
            )}
            {amazonData.product_type && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Type de produit</span>
                <p className="text-sm mt-1">{amazonData.product_type}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prix */}
      {(amazonData.list_price || amazonData.buy_box_price || amazonData.lowest_new_price) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Prix et Offres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {amazonData.list_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Prix de liste</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.list_price} €</p>
                </div>
              )}
              {amazonData.buy_box_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Buy Box</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.buy_box_price} €</p>
                </div>
              )}
              {amazonData.lowest_new_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Prix le plus bas (neuf)</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.lowest_new_price} €</p>
                </div>
              )}
            </div>
            {amazonData.offer_count_new && (
              <p className="text-sm text-muted-foreground mt-3">
                {amazonData.offer_count_new} offre(s) disponible(s)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Images Amazon */}
      {hasImages && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images Amazon ({amazonData.images.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Carousel className="w-full max-w-3xl mx-auto">
              <CarouselContent>
                {amazonData.images.map((img: any, index: number) => (
                  img.url && (
                    <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                      <div className="p-1">
                        <Card>
                          <CardContent className="flex aspect-square items-center justify-center p-2">
                            <img 
                              src={img.url} 
                              alt={`Amazon image ${index + 1}`}
                              className="object-contain w-full h-full"
                            />
                          </CardContent>
                        </Card>
                        {img.variant && (
                          <p className="text-xs text-center text-muted-foreground mt-1">
                            {img.variant}
                          </p>
                        )}
                      </div>
                    </CarouselItem>
                  )
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </CardContent>
        </Card>
      )}

      {/* Dimensions */}
      {(amazonData.item_dimensions || amazonData.package_dimensions) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {amazonData.item_dimensions && (
              <div>
                <h4 className="text-sm font-medium mb-2">Article</h4>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {amazonData.item_dimensions.length && (
                    <div>
                      <span className="text-muted-foreground">Longueur</span>
                      <p className="font-medium">{amazonData.item_dimensions.length.value} {amazonData.item_dimensions.length.unit}</p>
                    </div>
                  )}
                  {amazonData.item_dimensions.width && (
                    <div>
                      <span className="text-muted-foreground">Largeur</span>
                      <p className="font-medium">{amazonData.item_dimensions.width.value} {amazonData.item_dimensions.width.unit}</p>
                    </div>
                  )}
                  {amazonData.item_dimensions.height && (
                    <div>
                      <span className="text-muted-foreground">Hauteur</span>
                      <p className="font-medium">{amazonData.item_dimensions.height.value} {amazonData.item_dimensions.height.unit}</p>
                    </div>
                  )}
                  {amazonData.item_weight && (
                    <div>
                      <span className="text-muted-foreground">Poids</span>
                      <p className="font-medium">{amazonData.item_weight} kg</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {amazonData.package_dimensions && (
              <div>
                <h4 className="text-sm font-medium mb-2">Emballage</h4>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {amazonData.package_dimensions.length && (
                    <div>
                      <span className="text-muted-foreground">Longueur</span>
                      <p className="font-medium">{amazonData.package_dimensions.length.value} {amazonData.package_dimensions.length.unit}</p>
                    </div>
                  )}
                  {amazonData.package_dimensions.width && (
                    <div>
                      <span className="text-muted-foreground">Largeur</span>
                      <p className="font-medium">{amazonData.package_dimensions.width.value} {amazonData.package_dimensions.width.unit}</p>
                    </div>
                  )}
                  {amazonData.package_dimensions.height && (
                    <div>
                      <span className="text-muted-foreground">Hauteur</span>
                      <p className="font-medium">{amazonData.package_dimensions.height.value} {amazonData.package_dimensions.height.unit}</p>
                    </div>
                  )}
                  {amazonData.package_weight && (
                    <div>
                      <span className="text-muted-foreground">Poids</span>
                      <p className="font-medium">{amazonData.package_weight} kg</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Rank */}
      {hasSalesRank && (
        <Card>
          <CardHeader>
            <CardTitle>Classement des Ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {amazonData.sales_rank.map((rank: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm">{rank.category}</span>
                  <Badge variant="secondary">#{rank.rank}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      {hasFeatures && (
        <Card>
          <CardHeader>
            <CardTitle>Caractéristiques Produit</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {amazonData.features.map((feature: string, index: number) => (
                <li key={index} className="text-sm">{feature}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Détails supplémentaires */}
      {(amazonData.color || amazonData.size) && (
        <Card>
          <CardHeader>
            <CardTitle>Détails Supplémentaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {amazonData.color && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Couleur</span>
                  <p className="text-sm mt-1">{amazonData.color}</p>
                </div>
              )}
              {amazonData.size && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Taille</span>
                  <p className="text-sm mt-1">{amazonData.size}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
