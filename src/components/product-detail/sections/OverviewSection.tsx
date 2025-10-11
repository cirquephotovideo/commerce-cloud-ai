import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, TrendingUp } from "lucide-react";
import { extractAnalysisData } from "@/lib/analysisDataExtractors";

interface OverviewSectionProps {
  analysis: any;
  onEnrichClick?: (type: string) => void;
}

export const OverviewSection = ({ analysis, onEnrichClick }: OverviewSectionProps) => {
  const {
    productName,
    productPrice,
    estimatedPrice,
    productMargin,
  } = extractAnalysisData(analysis);

  const hasAmazonData = analysis.amazon_enriched_at !== null;
  const hasVideoData = analysis.video_url !== null;
  const imageCount = analysis.image_urls?.length || 0;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Vue d'Ensemble
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prix et Marge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Prix d'achat
            </div>
            <div className="text-2xl font-bold">{productPrice}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Prix de vente
            </div>
            <div className="text-2xl font-bold">{estimatedPrice || 'N/A'}</div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Marge
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {productMargin ? `${productMargin}%` : 'N/A'}
              </span>
              {productMargin && parseFloat(productMargin) > 0 && (
                <Badge variant="default" className="bg-green-600">
                  🟢
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Statuts d'enrichissement */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            ⚡ Statuts d'enrichissement
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="gap-1">
              ✅ IA Analysé
            </Badge>
            
            {hasAmazonData ? (
              <Badge variant="default" className="gap-1">
                ✅ Amazon
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => onEnrichClick?.('amazon')}>
                ⏳ Amazon
              </Badge>
            )}
            
            {hasVideoData ? (
              <Badge variant="default" className="gap-1">
                ✅ Vidéo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => onEnrichClick?.('video')}>
                ⏳ Vidéo
              </Badge>
            )}
            
            {imageCount > 0 ? (
              <Badge variant="default" className="gap-1">
                ✅ {imageCount} Images
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => onEnrichClick?.('images')}>
                ⏳ Images
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
