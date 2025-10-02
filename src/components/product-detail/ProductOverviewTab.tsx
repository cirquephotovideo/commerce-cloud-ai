import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { DetailedAnalysisView } from "@/components/DetailedAnalysisView";
import { getProductImages, getProductName, getProductPrice, getProductScore } from "@/lib/analysisDataExtractors";
import { Package } from "lucide-react";

interface ProductOverviewTabProps {
  analysis: any;
}

export const ProductOverviewTab = ({ analysis }: ProductOverviewTabProps) => {
  const images = getProductImages(analysis);
  const productName = getProductName(analysis);
  const productPrice = getProductPrice(analysis);
  const productScore = getProductScore(analysis);
  const tags = analysis?.tags || [];

  const [mainImage, setMainImage] = useState(images[0] || "");

  return (
    <div className="space-y-6">
      {/* Image Gallery */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Main Image */}
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

            {/* Product Info Summary */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{productName}</h2>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-bold text-primary">{productPrice}</span>
                  {productScore !== null && (
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      ⭐ {productScore}/10
                    </Badge>
                  )}
                </div>
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

              {/* Description longue si disponible */}
              {analysis?.description_long && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm leading-relaxed">{analysis.description_long}</p>
                </div>
              )}

              {/* Pros/Cons */}
              <div className="grid grid-cols-2 gap-4">
                {analysis?.competitive_pros && analysis.competitive_pros.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-green-600 mb-2">✅ Points forts</h3>
                    <ul className="text-sm space-y-1">
                      {analysis.competitive_pros.slice(0, 3).map((pro: string, i: number) => (
                        <li key={i} className="text-muted-foreground">• {pro}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysis?.competitive_cons && analysis.competitive_cons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-red-600 mb-2">⚠️ Points faibles</h3>
                    <ul className="text-sm space-y-1">
                      {analysis.competitive_cons.slice(0, 3).map((con: string, i: number) => (
                        <li key={i} className="text-muted-foreground">• {con}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Carousel */}
          {images.length > 1 && (
            <div className="mt-6">
              <Carousel className="w-full">
                <CarouselContent>
                  {images.map((img, index) => (
                    <CarouselItem key={index} className="basis-1/4 md:basis-1/6">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Analysis View */}
      <DetailedAnalysisView analysis={analysis} />
    </div>
  );
};
