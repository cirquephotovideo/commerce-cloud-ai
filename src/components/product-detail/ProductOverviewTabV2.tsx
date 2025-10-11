import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { extractAnalysisData, getRepairabilityData, getEnvironmentalData, getHSCodeData } from '@/lib/analysisDataExtractors';
import { EnrichmentStatusBadges } from './EnrichmentStatusBadges';
import { LiveSupplierPriceCard } from './LiveSupplierPriceCard';
import { EnrichmentTimeline } from './EnrichmentTimeline';
import { MediaGalleryUnified } from './MediaGalleryUnified';
import { VideoPlayer } from './VideoPlayer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, Euro, TrendingUp, Calendar, Wrench, Leaf, FileText, Ruler, Battery, Wifi } from 'lucide-react';

interface ProductOverviewTabV2Props {
  analysis: any;
  product: any;
  onEnrichClick?: (type: 'amazon' | 'video' | 'images') => void;
}

export const ProductOverviewTabV2 = ({ analysis, product, onEnrichClick }: ProductOverviewTabV2Props) => {
  const {
    productName,
    productPrice,
    productImages,
    estimatedPrice,
    productMargin,
  } = extractAnalysisData(analysis);

  const repairability = getRepairabilityData(analysis);
  const environmental = getEnvironmentalData(analysis);
  const hsCode = getHSCodeData(analysis);

  // Préparer les images pour la galerie unifiée
  const allImages = [
    ...(productImages || []).map(url => ({ url, source: 'analysis' as const })),
    ...(analysis.amazon_product_data?.images || []).map((img: any) => ({
      url: img.large || img.medium || img.small,
      source: 'amazon' as const,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* En-tête avec informations clés */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{productName || 'Produit sans nom'}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <Package className="h-3 w-3" />
                  EAN: {product?.ean || 'N/A'}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Analysé le {new Date(analysis.created_at).toLocaleDateString('fr-FR')}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Prix d'achat</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {productPrice ? `${productPrice}€` : 'N/A'}
              </div>
            </div>

            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">Prix de vente estimé</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {estimatedPrice ? `${estimatedPrice}€` : 'N/A'}
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-muted-foreground">Marge</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {productMargin ? `${productMargin}%` : 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statuts d'enrichissement */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Statuts d'Enrichissement</CardTitle>
          <CardDescription>
            Suivez en temps réel les enrichissements disponibles pour ce produit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnrichmentStatusBadges analysisId={analysis.id} onEnrichClick={onEnrichClick} />
        </CardContent>
      </Card>

      {/* Indice de Réparabilité & Impact Environnemental */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {repairability && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Indice de Réparabilité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {repairability.score !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Score</span>
                    <Badge variant={repairability.score >= 7 ? 'default' : repairability.score >= 5 ? 'secondary' : 'destructive'}>
                      {repairability.score}/10
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        repairability.score >= 8 ? 'bg-green-500' : 
                        repairability.score >= 6 ? 'bg-yellow-500' : 
                        'bg-orange-500'
                      }`}
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

        {environmental && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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

      {/* Code Douanier */}
      {hsCode && hsCode.code && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Galerie d'images */}
        <MediaGalleryUnified images={allImages} />

        {/* Timeline d'enrichissement */}
        <EnrichmentTimeline analysisId={analysis.id} />
      </div>

      {/* Vidéo promotionnelle */}
      <Card>
        <CardHeader>
          <CardTitle>🎬 Vidéo Promotionnelle IA</CardTitle>
          <CardDescription>
            Vidéo générée automatiquement pour présenter le produit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoPlayer analysisId={analysis.id} showCard={false} />
        </CardContent>
      </Card>

      {/* Prix fournisseurs en direct */}
      <LiveSupplierPriceCard analysisId={analysis.id} />

      {/* Détails techniques avancés (Accordion) */}
      {analysis.analysis_result && (
        <Card>
          <CardHeader>
            <CardTitle>🔧 Détails Techniques Avancés</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {/* Analyse complète (JSON) */}
              <AccordionItem value="json">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Analyse complète (JSON)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-xs">
                      {JSON.stringify(analysis.analysis_result, null, 2)}
                    </pre>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Dimensions */}
              {analysis.analysis_result.dimensions && (
                <AccordionItem value="dimensions">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4" />
                      Dimensions et Poids
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Object.entries(analysis.analysis_result.dimensions).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Batterie */}
              {analysis.analysis_result.battery && (
                <AccordionItem value="battery">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Battery className="h-4 w-4" />
                      Batterie
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Object.entries(analysis.analysis_result.battery).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Connectivité */}
              {analysis.analysis_result.connectivity && (
                <AccordionItem value="connectivity">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Connectivité
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Object.entries(analysis.analysis_result.connectivity).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Description et détails */}
      {analysis.analysis_result?.description && (
        <Card>
          <CardHeader>
            <CardTitle>📝 Description Complète</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {analysis.analysis_result.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Points forts et points faibles */}
      {(analysis.analysis_result?.pros || analysis.analysis_result?.cons) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {analysis.analysis_result.pros && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">✅ Points Forts</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.analysis_result.pros.map((pro: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span className="text-sm">{pro}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {analysis.analysis_result.cons && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">❌ Points Faibles</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.analysis_result.cons.map((con: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span className="text-sm">{con}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Spécifications techniques */}
      {analysis.analysis_result?.specifications && (
        <Card>
          <CardHeader>
            <CardTitle>🔧 Spécifications Techniques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {Object.entries(analysis.analysis_result.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-sm font-medium text-muted-foreground">{key}</span>
                  <span className="text-sm font-semibold">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
