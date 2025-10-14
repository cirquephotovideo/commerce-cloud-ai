import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { TaxonomyBadges } from "@/components/TaxonomyBadges";
import { EnrichmentStatusIndicator } from "./EnrichmentStatusIndicator";
import { getProductImages, getProductName, getProductPrice, getProductScore, getProductCategory } from "@/lib/analysisDataExtractors";
import { Package, Heart, Share2, Download, Star, CheckCircle2, AlertCircle, Info, Zap, Box, Wifi, Battery, Ruler, Weight, Calendar, ShieldCheck, TrendingUp, Sparkles, Loader2, Video as VideoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { VideoPlayer } from "./VideoPlayer";

interface ProductOverviewTabProps {
  analysis: any;
}

export const ProductOverviewTab = ({ analysis }: ProductOverviewTabProps) => {
  const { toast } = useToast();
  
  // Safety check
  if (!analysis) {
    return <div className="p-6 text-center text-muted-foreground">Aucune donnée disponible</div>;
  }

  // Navigation handler for accordion sections
  const handleNavigateToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      // Open the accordion item
      element.click();
      // Scroll into view
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const images = getProductImages(analysis) || [];
  const productName = getProductName(analysis) || "Produit sans nom";
  const productPrice = getProductPrice(analysis) || "";
  const productScore = getProductScore(analysis);
  const productCategory = getProductCategory(analysis) || "";
  const tags = analysis?.tags || [];

  const [mainImage, setMainImage] = useState(images[0] || "");
  const [hasTaxonomy, setHasTaxonomy] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAmazonData, setHasAmazonData] = useState(false);
  const [isEnrichingAmazon, setIsEnrichingAmazon] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

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

  // Check if taxonomy already exists
  useEffect(() => {
    const checkTaxonomy = async () => {
      if (!analysis?.id) return;
      
      const { data, error } = await supabase
        .from('product_taxonomy_mappings')
        .select('id')
        .eq('analysis_id', analysis.id)
        .limit(1);
      
      setHasTaxonomy(!!data && data.length > 0);
    };
    
    checkTaxonomy();
  }, [analysis?.id]);

  // Check if Amazon data exists
  useEffect(() => {
    const checkAmazonData = async () => {
      if (!analysis?.id) return;
      
      const { data } = await supabase
        .from('amazon_product_data')
        .select('id')
        .eq('analysis_id', analysis.id)
        .maybeSingle();
      
      setHasAmazonData(!!data);
    };
    
    checkAmazonData();
  }, [analysis?.id]);

  // Check if video exists
  useEffect(() => {
    const checkVideo = async () => {
      if (!analysis?.id) return;
      
      const { data } = await supabase
        .from('product_videos')
        .select('id')
        .eq('analysis_id', analysis.id)
        .maybeSingle();
      
      setHasVideo(!!data);
    };
    
    checkVideo();
  }, [analysis?.id]);

  // Generate taxonomy with AI
  const handleGenerateTaxonomy = async () => {
    if (!analysis?.id) return;
    
    setIsGenerating(true);
    
    try {
      const { error } = await supabase.functions.invoke('ai-taxonomy-categorizer', {
        body: { analysis_id: analysis.id }
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Catégorisation réussie !",
        description: "Les taxonomies Google et Amazon ont été générées avec l'IA.",
      });
      
      setHasTaxonomy(true);
      
      // Scroll to taxonomy badges after generation
      setTimeout(() => {
        document.querySelector('[data-taxonomy-badges]')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300);
    } catch (error) {
      console.error('Taxonomy generation error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de générer les catégories. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Enrich with Amazon data
  const handleAmazonEnrichment = async () => {
    if (!analysis?.id) return;
    
    setIsEnrichingAmazon(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('amazon-product-enrichment', {
        body: { analysis_id: analysis.id }
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Données Amazon synchronisées",
        description: "Les informations produit Amazon ont été récupérées avec succès",
      });
      
      setHasAmazonData(true);
    } catch (error: any) {
      console.error('Amazon enrichment error:', error);
      
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
          title: "❌ Erreur Amazon",
          description: error.message || "Impossible d'enrichir avec Amazon. Veuillez réessayer.",
          variant: "destructive",
        });
      }
    } finally {
      setIsEnrichingAmazon(false);
    }
  };

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
              {images && images.length > 1 && (
                <div className="mt-4">
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
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </button>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                </div>
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

                {/* Category, Brand and Taxonomy */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  
                {/* Taxonomy Section with Auto-Generate Button */}
                  {!hasTaxonomy ? (
                    <Button 
                      variant="outline" 
                      className="w-full border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md"
                      onClick={handleGenerateTaxonomy}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span className="text-sm">🤖 Catégorisation en cours...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse text-primary" />
                          <span className="text-sm font-medium">🎯 Générer les taxonomies Google & Amazon avec l'IA</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <div data-taxonomy-badges>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground font-medium">Catégories e-commerce</p>
                        <EnrichmentStatusIndicator 
                          status="completed" 
                          label="Taxonomie" 
                          onClick={() => handleNavigateToSection('overview')}
                        />
                      </div>
                      <TaxonomyBadges analysisId={analysis.id} />
                    </div>
                  )}
                </div>

                {/* Amazon Enrichment Section */}
                <div className="pt-2">
                  {!hasAmazonData ? (
                    <Button 
                      variant="outline"
                      className="w-full bg-gradient-to-r from-orange-500/10 to-yellow-600/10 border-orange-500/50 hover:border-orange-600 hover:from-orange-500/20 hover:to-yellow-600/20 transition-all group shadow-sm hover:shadow-md"
                      onClick={handleAmazonEnrichment}
                      disabled={isEnrichingAmazon}
                    >
                      {isEnrichingAmazon ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span className="text-sm">📦 Synchronisation Amazon...</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4 mr-2 group-hover:animate-bounce text-orange-600" />
                          <span className="text-sm font-medium">📦 Enrichir avec Amazon Seller</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <span className="text-sm text-orange-800 dark:text-orange-300 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        ✅ Données Amazon synchronisées
                      </span>
                      <EnrichmentStatusIndicator 
                        status={analysis.enrichment_status?.amazon || 'completed'} 
                        onClick={() => handleNavigateToSection('amazon')}
                      />
                    </div>
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
                  Exporter
                </Button>
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

      {/* Vidéo Promotionnelle HeyGen */}
      {hasVideo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <VideoIcon className="w-5 w-5" />
                Vidéo Promotionnelle HeyGen
              </span>
              <EnrichmentStatusIndicator 
                status={analysis.enrichment_status?.heygen || 'completed'} 
                onClick={() => handleNavigateToSection('video')}
              />
            </CardTitle>
            <CardDescription>
              Vidéo générée avec un avatar IA pour présenter le produit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VideoPlayer analysisId={analysis.id} showCard={false} />
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
