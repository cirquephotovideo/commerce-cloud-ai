import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Star, TrendingDown, TrendingUp, Package } from "lucide-react";
import { ThemedImageGenerator } from "@/components/ThemedImageGenerator";

interface ProductOffer {
  id: string;
  product_name: string;
  product_url: string;
  current_price: number;
  stock_status: string;
  image_url?: string;
  description?: string;
  rating?: number;
  reviews_count?: number;
  scraped_at: string;
  competitor_sites?: {
    site_name: string;
  };
}

interface ProductMonitoringDetailProps {
  product: ProductOffer | null;
  allOffers: ProductOffer[];
  isOpen: boolean;
  onClose: () => void;
}

export const ProductMonitoringDetail = ({ 
  product, 
  allOffers, 
  isOpen, 
  onClose 
}: ProductMonitoringDetailProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!product) return null;

  const sortedOffers = [...allOffers].sort((a, b) => a.current_price - b.current_price);
  const bestPrice = sortedOffers[0]?.current_price;
  const avgPrice = allOffers.reduce((sum, o) => sum + o.current_price, 0) / allOffers.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {product.product_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="offers">
              Offres ({allOffers.length})
            </TabsTrigger>
            <TabsTrigger value="images">Génération d'images</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image principale */}
              <div className="space-y-2">
                <div className="aspect-square bg-accent rounded-lg overflow-hidden border-2 border-border">
                  {selectedImage || product.image_url ? (
                    <img
                      src={selectedImage || product.image_url}
                      alt={product.product_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="w-24 h-24 opacity-20" />
                    </div>
                  )}
                </div>
                {/* Miniatures des autres offres avec images */}
                <div className="flex gap-2 overflow-x-auto">
                  {allOffers
                    .filter(o => o.image_url)
                    .map((offer) => (
                      <button
                        key={offer.id}
                        onClick={() => setSelectedImage(offer.image_url!)}
                        className="flex-shrink-0 w-16 h-16 rounded border-2 border-border hover:border-primary transition-colors overflow-hidden"
                      >
                        <img
                          src={offer.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                </div>
              </div>

              {/* Informations produit */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Informations</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {product.description}
                    </p>
                  )}
                  
                  {product.rating && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(product.rating!)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {product.rating.toFixed(1)}
                        {product.reviews_count && ` (${product.reviews_count} avis)`}
                      </span>
                    </div>
                  )}

                  <Badge variant={product.stock_status === "in_stock" ? "default" : "destructive"}>
                    {product.stock_status === "in_stock" ? "En Stock" : "Rupture de stock"}
                  </Badge>
                </div>

                {/* Statistiques de prix */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Meilleur prix</span>
                      <span className="text-2xl font-bold text-green-500">
                        {bestPrice}€
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Prix moyen</span>
                      <span className="text-lg font-semibold">
                        {avgPrice.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nombre d'offres</span>
                      <Badge variant="secondary">{allOffers.length}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  className="w-full"
                  onClick={() => window.open(product.product_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Voir sur le site
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="offers" className="space-y-3">
            <div className="text-sm text-muted-foreground mb-4">
              {allOffers.length} offre{allOffers.length > 1 ? 's' : ''} trouvée{allOffers.length > 1 ? 's' : ''} pour ce produit
            </div>
            
            {sortedOffers.map((offer, index) => {
              const priceDiff = ((offer.current_price - bestPrice) / bestPrice) * 100;
              const isBestPrice = index === 0;

              return (
                <Card key={offer.id} className={isBestPrice ? "border-2 border-green-500" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {offer.image_url && (
                        <div className="w-20 h-20 flex-shrink-0 rounded border overflow-hidden">
                          <img
                            src={offer.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-medium">
                              {offer.competitor_sites?.site_name || 'Site inconnu'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Scrappé le {new Date(offer.scraped_at).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className={`text-xl font-bold ${isBestPrice ? 'text-green-500' : ''}`}>
                              {offer.current_price}€
                            </div>
                            {!isBestPrice && priceDiff > 0 && (
                              <div className="text-xs text-red-500 flex items-center justify-end">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                +{priceDiff.toFixed(0)}%
                              </div>
                            )}
                            {isBestPrice && (
                              <Badge variant="default" className="text-xs mt-1">
                                Meilleur prix
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={offer.stock_status === "in_stock" ? "default" : "destructive"} className="text-xs">
                            {offer.stock_status === "in_stock" ? "En Stock" : "Rupture"}
                          </Badge>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(offer.product_url, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Voir l'offre
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="images">
            <ThemedImageGenerator
              productName={product.product_name}
              onImageGenerated={(url) => setSelectedImage(url)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};