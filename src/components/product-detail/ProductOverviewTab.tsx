import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { getProductImages, getProductName, getProductPrice, getProductScore, getProductCategory } from "@/lib/analysisDataExtractors";
import { Package, Heart, Share2, Download, Star, CheckCircle2, AlertCircle, Info, Zap, Box, Wifi, Battery, Ruler, Weight, Calendar, ShieldCheck, TrendingUp } from "lucide-react";

interface ProductOverviewTabProps {
  analysis: any;
}

export const ProductOverviewTab = ({ analysis }: ProductOverviewTabProps) => {
  const images = getProductImages(analysis);
  const productName = getProductName(analysis);
  const productPrice = getProductPrice(analysis);
  const productScore = getProductScore(analysis);
  const productCategory = getProductCategory(analysis);
  const tags = analysis?.tags || [];

  const [mainImage, setMainImage] = useState(images[0] || "");

  // Extract data from analysis
  const description = analysis?.analysis_result?.description?.suggested_description || analysis?.description_long || "";
  const keyFeatures = analysis?.analysis_result?.key_features || [];
  const pros = analysis?.competitive_pros || [];
  const cons = analysis?.competitive_cons || [];
  const specifications = analysis?.analysis_result?.technical_specifications || {};
  const reviews = analysis?.analysis_result?.customer_reviews || {};
  const brand = analysis?.analysis_result?.brand || "";
  const availability = analysis?.analysis_result?.availability || "";
  const popularityScore = analysis?.analysis_result?.popularity_score || null;
  const warranty = analysis?.analysis_result?.warranty || "";
  const releaseDate = analysis?.analysis_result?.release_date || "";

  return (
    <div className="space-y-6">
      {/* Header avec Image et Informations Principales */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Main Image */}
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden border-2 border-border">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={productName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Package className="w-32 h-32 opacity-20" />
                  </div>
                )}
              </div>

              {/* Image Carousel */}
              {images.length > 1 && (
                <Carousel className="w-full">
                  <CarouselContent>
                    {images.map((img, index) => (
                      <CarouselItem key={index} className="basis-1/4 md:basis-1/5">
                        <button
                          onClick={() => setMainImage(img)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            mainImage === img ? "border-primary" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={img}
                            alt={`${productName} - ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              )}
            </div>

            {/* Product Info Summary */}
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-bold mb-3">{productName}</h2>
                
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-4xl font-bold text-primary">{productPrice}</span>
                  {productScore !== null && (
                    <Badge variant="default" className="text-lg px-4 py-2">
                      <Star className="w-4 h-4 mr-1 fill-current" />
                      {productScore}/10
                    </Badge>
                  )}
                </div>

                {/* Category and Brand */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {productCategory && (
                    <Badge variant="secondary">
                      <Box className="w-3 h-3 mr-1" />
                      {productCategory}
                    </Badge>
                  )}
                  {brand && (
                    <Badge variant="outline">
                      {brand}
                    </Badge>
                  )}
                  {availability && (
                    <Badge variant={availability.toLowerCase().includes('stock') ? 'default' : 'destructive'}>
                      {availability}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm">
                  <Heart className="w-4 h-4 mr-2" />
                  Favori
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Short Summary */}
              {description && description.length < 300 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Résumé</h3>
                  <p className="text-sm leading-relaxed">{description}</p>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {releaseDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date de sortie</p>
                      <p className="text-sm font-medium">{releaseDate}</p>
                    </div>
                  </div>
                )}
                {warranty && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Garantie</p>
                      <p className="text-sm font-medium">{warranty}</p>
                    </div>
                  </div>
                )}
                {popularityScore !== null && (
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Popularité</p>
                      <p className="text-sm font-medium">{popularityScore}/10</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description Complète */}
      {description && description.length >= 300 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Description Complète
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{description}</p>
          </CardContent>
        </Card>
      )}

      {/* Caractéristiques Clés */}
      {keyFeatures && keyFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Caractéristiques Clés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {keyFeatures.map((feature: string, i: number) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points Forts et Points Faibles */}
      {(pros.length > 0 || cons.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Points Forts */}
          {pros.length > 0 && (
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Points Forts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue={pros.length <= 5 ? "item-1" : undefined}>
                  <AccordionItem value="item-1" className="border-none">
                    <AccordionTrigger className="text-sm font-medium py-0 pb-3 hover:no-underline">
                      {pros.length} avantage{pros.length > 1 ? 's' : ''} identifié{pros.length > 1 ? 's' : ''}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {pros.map((pro: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Points Faibles */}
          {cons.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  Points Faibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue={cons.length <= 5 ? "item-1" : undefined}>
                  <AccordionItem value="item-1" className="border-none">
                    <AccordionTrigger className="text-sm font-medium py-0 pb-3 hover:no-underline">
                      {cons.length} inconvénient{cons.length > 1 ? 's' : ''} identifié{cons.length > 1 ? 's' : ''}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {cons.map((con: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Spécifications Techniques */}
      {specifications && Object.keys(specifications).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Spécifications Techniques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {specifications.dimensions && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Ruler className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dimensions</p>
                    <p className="text-sm font-medium">{specifications.dimensions}</p>
                  </div>
                </div>
              )}
              {specifications.weight && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Weight className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Poids</p>
                    <p className="text-sm font-medium">{specifications.weight}</p>
                  </div>
                </div>
              )}
              {specifications.connectivity && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Wifi className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Connectivité</p>
                    <p className="text-sm font-medium">{specifications.connectivity}</p>
                  </div>
                </div>
              )}
              {specifications.battery && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Battery className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Batterie</p>
                    <p className="text-sm font-medium">{specifications.battery}</p>
                  </div>
                </div>
              )}
              {Object.entries(specifications).map(([key, value]) => {
                if (!['dimensions', 'weight', 'connectivity', 'battery'].includes(key) && value) {
                  return (
                    <div key={key} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Box className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-medium">{String(value)}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avis Clients */}
      {reviews && (reviews.rating || reviews.count) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Avis Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {reviews.rating && (
                  <div className="flex items-center gap-2">
                    <div className="text-4xl font-bold">{reviews.rating}</div>
                    <div className="flex flex-col">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < Math.floor(reviews.rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">sur 5 étoiles</p>
                    </div>
                  </div>
                )}
                {reviews.count && (
                  <div className="text-sm text-muted-foreground">
                    Basé sur {reviews.count.toLocaleString()} avis
                  </div>
                )}
              </div>
              {reviews.summary && (
                <p className="text-sm leading-relaxed">{reviews.summary}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyse Détaillée */}
      <DetailedAnalysisView analysis={analysis} />
    </div>
  );
};
