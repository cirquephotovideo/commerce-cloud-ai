import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Package, Wrench, Leaf, FileText, Images } from "lucide-react";
import { ProductImageGallery } from "./ProductImageGallery";
import {
  getRepairabilityData,
  getEnvironmentalData,
  getHSCodeData,
  getProductImages,
  getProductName,
  getProductPrice,
  getProductScore,
  getProductCategory
} from "@/lib/analysisDataExtractors";

interface DetailedAnalysisViewProps {
  analysis: any;
}

export const DetailedAnalysisView = ({ analysis }: DetailedAnalysisViewProps) => {
  const productName = getProductName(analysis);
  const productPrice = getProductPrice(analysis);
  const productScore = getProductScore(analysis);
  const productCategory = getProductCategory(analysis);
  const images = getProductImages(analysis);
  const repairability = getRepairabilityData(analysis);
  const environmental = getEnvironmentalData(analysis);
  const hsCode = getHSCodeData(analysis);

  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 8) return "bg-green-500";
    if (score >= 6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getRepairabilityBadgeVariant = (score: number | null): "default" | "secondary" | "destructive" => {
    if (!score) return "secondary";
    if (score >= 7) return "default";
    if (score >= 5) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-4">
      {/* Product Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {productName}
              </CardTitle>
              <CardDescription className="flex items-center gap-3">
                <span className="font-semibold text-foreground">{productPrice}</span>
                <span>•</span>
                <span>{productCategory}</span>
              </CardDescription>
            </div>
            {productScore !== null && (
              <Badge variant="outline" className="text-lg px-3 py-1">
                ⭐ {productScore}/10
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Repairability Section */}
        {repairability && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5" />
                Indice de Réparabilité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {repairability.score !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Score</span>
                    <Badge variant={getRepairabilityBadgeVariant(repairability.score)}>
                      {repairability.score}/10
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreColor(repairability.score)}`}
                      style={{ width: `${(repairability.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facilité de réparation:</span>
                  <span className="font-medium">{repairability.ease}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pièces détachées:</span>
                  <span className="font-medium">{repairability.spareParts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Durabilité:</span>
                  <span className="font-medium">{repairability.durability}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Environmental Section */}
        {environmental && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Leaf className="h-5 w-5" />
                Impact Environnemental
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {environmental.ecoScore !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Éco-score</span>
                    <Badge variant="default" className="bg-green-600">
                      {environmental.ecoScore}/10
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-green-600"
                      style={{ width: `${(environmental.ecoScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Émissions CO2:</span>
                  <span className="font-medium">{environmental.co2Emissions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recyclabilité:</span>
                  <span className="font-medium">{environmental.recyclability}</span>
                </div>
                {environmental.certifications.length > 0 && (
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground block mb-2">Certifications:</span>
                    <div className="flex flex-wrap gap-1">
                      {environmental.certifications.map((cert, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* HS Code Section */}
      {hsCode && hsCode.code && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Code Douanier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-base px-3 py-1 font-mono">
                HS: {hsCode.code}
              </Badge>
              <span className="text-sm text-muted-foreground">{hsCode.description}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEO Section */}
      {analysis?.analysis_result?.seo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              🎯 Optimisation SEO
              <Badge variant="outline">{analysis.analysis_result.seo.score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Titre:</span>
                <p className="mt-1">{analysis.analysis_result.seo.title}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Meta Description:</span>
                <p className="mt-1 text-muted-foreground">{analysis.analysis_result.seo.meta_description}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Mots-clés:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysis.analysis_result.seo.keywords?.map((keyword: string, i: number) => (
                    <Badge key={i} variant="secondary">{keyword}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Trends Section */}
      {analysis?.analysis_result?.trends && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              📈 Tendances du Marché
              <Badge variant="outline">{analysis.analysis_result.trends.popularity_score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendance:</span>
                <span className="font-medium">{analysis.analysis_result.trends.market_trend}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Perspectives:</span>
                <p className="mt-1 text-muted-foreground">{analysis.analysis_result.trends.future_outlook}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimized Description Section */}
      {analysis?.analysis_result?.description && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              📝 Description Optimisée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{analysis.analysis_result.description.suggested_description}</p>
            {analysis.analysis_result.description.key_features && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Caractéristiques clés:</span>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  {analysis.analysis_result.description.key_features.map((feature: string, i: number) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Competitive Analysis Section */}
      {analysis?.analysis_result?.competition && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              🏆 Analyse Concurrentielle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Principaux concurrents:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysis.analysis_result.competition.main_competitors?.map((competitor: string, i: number) => (
                    <Badge key={i} variant="outline">{competitor}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Différenciation:</span>
                <p className="mt-1 text-muted-foreground">{analysis.analysis_result.competition.differentiation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Report Section */}
      {analysis?.analysis_result?.global_report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              📊 Rapport Global
              <Badge variant="outline">{analysis.analysis_result.global_report.overall_score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.analysis_result.global_report.strengths && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Points forts:</span>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  {analysis.analysis_result.global_report.strengths.map((strength: string, i: number) => (
                    <li key={i} className="text-green-600">{strength}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.analysis_result.global_report.weaknesses && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Points faibles:</span>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  {analysis.analysis_result.global_report.weaknesses.map((weakness: string, i: number) => (
                    <li key={i} className="text-orange-600">{weakness}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.analysis_result.global_report.recommendations && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Recommandations:</span>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  {analysis.analysis_result.global_report.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Image Gallery */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Images className="h-5 w-5" />
              Galerie d'images ({images.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductImageGallery images={images} productName={productName} />
          </CardContent>
        </Card>
      )}

      {/* Technical Details Accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détails techniques complets</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="specifications">
              <AccordionTrigger>Spécifications</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(analysis?.analysis_result?.technical?.specs_data || {}, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="compatibility">
              <AccordionTrigger>Compatibilité</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(analysis?.analysis_result?.technical?.compatibility_data || {}, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="full-analysis">
              <AccordionTrigger>Analyse complète (JSON)</AccordionTrigger>
              <AccordionContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                  {JSON.stringify(analysis?.analysis_result || {}, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
