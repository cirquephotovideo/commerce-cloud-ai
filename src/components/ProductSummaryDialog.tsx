import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Star,
  Heart,
  Share2,
  Download,
  CheckCircle2,
  AlertCircle,
  Info,
  Zap,
  Box,
  Wifi,
  Battery,
  Ruler,
  Weight,
  Calendar,
  ShieldCheck,
  TrendingUp,
  Package,
  Award,
} from "lucide-react";
import { 
  getProductImages, 
  getProductName, 
  getProductPrice, 
  getProductScore,
  getProductCategory 
} from "@/lib/analysisDataExtractors";

interface ProductSummaryDialogProps {
  analysis: any;
  productName: string;
}

export function ProductSummaryDialog({ analysis, productName }: ProductSummaryDialogProps) {
  const [open, setOpen] = useState(false);

  // Extract product data
  const images = getProductImages(analysis.analysis_result);
  const name = getProductName(analysis.analysis_result);
  const price = getProductPrice(analysis.analysis_result);
  const score = getProductScore(analysis.analysis_result);
  const category = getProductCategory(analysis.analysis_result);

  // Extract additional data
  const description = analysis.analysis_result?.description?.suggested_description || 
                      analysis.description_long || 
                      analysis.analysis_result?.description_long || 
                      "Aucune description disponible";

  const keyFeatures = analysis.analysis_result?.key_features || 
                      analysis.analysis_result?.features?.key_features || 
                      [];

  const pros = analysis.competitive_pros || 
               analysis.analysis_result?.pros || 
               analysis.analysis_result?.advantages || 
               [];

  const cons = analysis.competitive_cons || 
               analysis.analysis_result?.cons || 
               analysis.analysis_result?.disadvantages || 
               [];

  const specifications = analysis.analysis_result?.specifications || 
                         analysis.analysis_result?.technical_specifications || 
                         {};

  const brand = analysis.analysis_result?.brand || 
                analysis.analysis_result?.manufacturer || 
                "";

  const availability = analysis.analysis_result?.availability || 
                       analysis.analysis_result?.stock_status || 
                       "En stock";

  const reviews = {
    rating: analysis.analysis_result?.rating || 
            analysis.analysis_result?.reviews?.rating || 
            0,
    count: analysis.analysis_result?.review_count || 
           analysis.analysis_result?.reviews?.count || 
           0,
    summary: analysis.analysis_result?.reviews?.summary || 
             analysis.analysis_result?.customer_feedback || 
             ""
  };

  const popularityScore = analysis.analysis_result?.popularity_score || 
                          analysis.analysis_result?.market_position?.popularity || 
                          0;

  const warranty = analysis.analysis_result?.warranty || 
                   analysis.analysis_result?.guarantee || 
                   "";

  const releaseDate = analysis.analysis_result?.release_date || 
                      analysis.analysis_result?.launch_date || 
                      "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Résumé
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Résumé du Produit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Header with Image and Key Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Product Image */}
                {images && images.length > 0 && (
                  <div className="w-full md:w-48 h-48 flex-shrink-0">
                    <img
                      src={images[0]}
                      alt={name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold">{name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {category && <Badge variant="secondary"><Package className="w-3 h-3 mr-1" />{category}</Badge>}
                      {brand && <Badge variant="outline"><Award className="w-3 h-3 mr-1" />{brand}</Badge>}
                      {availability && <Badge variant="default">{availability}</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center">
                    {score !== null && (
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="text-xl font-bold">{score}/10</span>
                      </div>
                    )}
                    {price && (
                      <div className="text-2xl font-bold text-primary">{price}</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Heart className="w-4 h-4 mr-2" />
                      Favori
                    </Button>
                    <Button size="sm" variant="outline">
                      <Share2 className="w-4 h-4 mr-2" />
                      Partager
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Exporter
                    </Button>
                  </div>

                  {/* Additional Quick Info */}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {releaseDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{releaseDate}</span>
                      </div>
                    )}
                    {warranty && (
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>{warranty}</span>
                      </div>
                    )}
                    {popularityScore > 0 && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        <span>Score: {popularityScore}/100</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {description && description !== "Aucune description disponible" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Description Complète
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {description.length > 500 ? description.substring(0, 500) + "..." : description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Key Features */}
          {keyFeatures && keyFeatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Caractéristiques Clés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {keyFeatures.slice(0, 8).map((feature: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pros and Cons */}
          {((pros && pros.length > 0) || (cons && cons.length > 0)) && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pros */}
              {pros && pros.length > 0 && (
                <Card className="border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      Points Forts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="pros">
                        <AccordionTrigger className="text-sm">
                          Voir tous les points forts ({pros.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            {pros.map((pro: string, index: number) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    {/* Show first 3 by default */}
                    <ul className="space-y-2 mb-2">
                      {pros.slice(0, 3).map((pro: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Cons */}
              {cons && cons.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      Points Faibles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="cons">
                        <AccordionTrigger className="text-sm">
                          Voir tous les points faibles ({cons.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-2">
                            {cons.map((con: string, index: number) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    {/* Show first 3 by default */}
                    <ul className="space-y-2 mb-2">
                      {cons.slice(0, 3).map((con: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Technical Specifications */}
          {specifications && Object.keys(specifications).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  Spécifications Techniques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {specifications.dimensions && (
                    <div className="flex flex-col items-center text-center p-3 bg-muted rounded-lg">
                      <Ruler className="w-6 h-6 mb-2 text-primary" />
                      <div className="text-xs text-muted-foreground">Dimensions</div>
                      <div className="text-sm font-semibold mt-1">{specifications.dimensions}</div>
                    </div>
                  )}
                  {specifications.weight && (
                    <div className="flex flex-col items-center text-center p-3 bg-muted rounded-lg">
                      <Weight className="w-6 h-6 mb-2 text-primary" />
                      <div className="text-xs text-muted-foreground">Poids</div>
                      <div className="text-sm font-semibold mt-1">{specifications.weight}</div>
                    </div>
                  )}
                  {specifications.connectivity && (
                    <div className="flex flex-col items-center text-center p-3 bg-muted rounded-lg">
                      <Wifi className="w-6 h-6 mb-2 text-primary" />
                      <div className="text-xs text-muted-foreground">Connectivité</div>
                      <div className="text-sm font-semibold mt-1">{specifications.connectivity}</div>
                    </div>
                  )}
                  {specifications.battery && (
                    <div className="flex flex-col items-center text-center p-3 bg-muted rounded-lg">
                      <Battery className="w-6 h-6 mb-2 text-primary" />
                      <div className="text-xs text-muted-foreground">Batterie</div>
                      <div className="text-sm font-semibold mt-1">{specifications.battery}</div>
                    </div>
                  )}
                  {/* Additional specs */}
                  {Object.entries(specifications)
                    .filter(([key]) => !['dimensions', 'weight', 'connectivity', 'battery'].includes(key))
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-col items-center text-center p-3 bg-muted rounded-lg">
                        <Box className="w-6 h-6 mb-2 text-primary" />
                        <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm font-semibold mt-1">{String(value)}</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Reviews */}
          {reviews.rating > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Avis Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold">{reviews.rating}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(reviews.rating)
                              ? "text-yellow-500 fill-yellow-500"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {reviews.count > 0 && (
                    <span className="text-muted-foreground">
                      ({reviews.count.toLocaleString()} avis)
                    </span>
                  )}
                </div>
                {reviews.summary && (
                  <p className="text-sm text-muted-foreground">{reviews.summary}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Detailed Analysis Summary */}
          <div className="text-sm text-muted-foreground text-center">
            Pour plus de détails, consultez l'analyse complète en cliquant sur "Voir détails"
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
