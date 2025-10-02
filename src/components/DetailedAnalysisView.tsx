import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Package, Wrench, Leaf, FileText, Images, Ruler, Battery, Wifi, 
  Cpu, Monitor, Smartphone, Tag, TrendingUp, Star, Zap, Shield
} from "lucide-react";
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

// Helper function to extract technical specs in a structured way
const extractTechnicalSpecs = (analysis: any) => {
  const specs = analysis?.analysis_result?.technical_specs || 
                analysis?.analysis_result?.specs || 
                {};
  
  return {
    dimensions: {
      width: specs.width || specs.dimensions?.width,
      height: specs.height || specs.dimensions?.height,
      depth: specs.depth || specs.dimensions?.depth || specs.dimensions?.length,
      weight: specs.weight || specs.dimensions?.weight,
      unit: specs.unit || 'mm'
    },
    materials: specs.materials || specs.material || specs.build_material,
    connectivity: {
      bluetooth: specs.bluetooth || specs.connectivity?.bluetooth,
      wifi: specs.wifi || specs.connectivity?.wifi,
      usb: specs.usb || specs.connectivity?.usb,
      ports: specs.ports || specs.connectivity?.ports
    },
    battery: {
      capacity: specs.battery_capacity || specs.battery?.capacity,
      type: specs.battery_type || specs.battery?.type,
      life: specs.battery_life || specs.battery?.life
    },
    performance: {
      processor: specs.processor || specs.cpu,
      ram: specs.ram || specs.memory,
      storage: specs.storage || specs.disk_space,
      gpu: specs.gpu || specs.graphics
    },
    display: {
      size: specs.screen_size || specs.display?.size,
      resolution: specs.resolution || specs.display?.resolution,
      type: specs.display_type || specs.display?.type,
      refresh_rate: specs.refresh_rate || specs.display?.refresh_rate
    },
    sensor: analysis?.analysis_result?.sensor_details || {}
  };
};

export const DetailedAnalysisView = ({ analysis }: DetailedAnalysisViewProps) => {
  const productName = getProductName(analysis);
  const productPrice = getProductPrice(analysis);
  const productScore = getProductScore(analysis);
  const productCategory = getProductCategory(analysis);
  const images = getProductImages(analysis);
  const repairability = getRepairabilityData(analysis);
  const environmental = getEnvironmentalData(analysis);
  const hsCode = getHSCodeData(analysis);
  const specs = extractTechnicalSpecs(analysis);
  const tags = analysis?.tags || [];
  const pricing = analysis?.analysis_result?.pricing || {};
  const reviews = analysis?.analysis_result?.customer_reviews || {};

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

  // Helper to render a spec item
  const SpecItem = ({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) => {
    if (!value || value === 'Non spécifié' || value === 'N/A') return null;
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    );
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

      {/* Tags Section */}
      {tags && tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="px-3 py-1">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Details */}
      {pricing && Object.keys(pricing).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Détails Tarifaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <SpecItem label="Prix recommandé" value={pricing.recommended_price} />
              <SpecItem label="Prix marché" value={pricing.market_price} />
              <SpecItem label="Positionnement" value={pricing.positioning} />
              {pricing.discount && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    💰 Réduction disponible: {pricing.discount}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Reviews Summary */}
      {reviews && (reviews.rating || reviews.count) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5" />
              Avis Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              {reviews.rating && (
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold">{reviews.rating}</div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.round(reviews.rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {reviews.count && (
                <div className="text-sm text-muted-foreground">
                  Basé sur {reviews.count} avis
                </div>
              )}
            </div>
            {reviews.summary && (
              <p className="text-sm text-muted-foreground">{reviews.summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Global Report Section */}
      {analysis?.analysis_result?.global_report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Rapport Global
              <Badge variant="outline">{analysis.analysis_result.global_report.overall_score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.analysis_result.global_report.strengths && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Points forts:</span>
                <ul className="mt-2 space-y-2">
                  {analysis.analysis_result.global_report.strengths.map((strength: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.analysis_result.global_report.weaknesses && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Points faibles:</span>
                <ul className="mt-2 space-y-2">
                  {analysis.analysis_result.global_report.weaknesses.map((weakness: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-500 mt-0.5">⚠</span>
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.analysis_result.global_report.recommendations && (
              <div>
                <span className="font-medium text-sm text-muted-foreground">Recommandations:</span>
                <ul className="mt-2 space-y-2">
                  {analysis.analysis_result.global_report.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">→</span>
                      <span>{rec}</span>
                    </li>
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

      {/* Technical Specifications Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Dimensions & Weight */}
        {(specs.dimensions.width || specs.dimensions.height || specs.dimensions.weight) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ruler className="h-5 w-5" />
                Dimensions & Poids
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Largeur" value={specs.dimensions.width ? `${specs.dimensions.width} ${specs.dimensions.unit}` : null} />
              <SpecItem label="Hauteur" value={specs.dimensions.height ? `${specs.dimensions.height} ${specs.dimensions.unit}` : null} />
              <SpecItem label="Profondeur" value={specs.dimensions.depth ? `${specs.dimensions.depth} ${specs.dimensions.unit}` : null} />
              <SpecItem label="Poids" value={specs.dimensions.weight} />
              <SpecItem label="Matériaux" value={specs.materials} />
            </CardContent>
          </Card>
        )}

        {/* Performance */}
        {(specs.performance.processor || specs.performance.ram || specs.performance.storage) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="h-5 w-5" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Processeur" value={specs.performance.processor} icon={<Zap className="h-4 w-4" />} />
              <SpecItem label="Mémoire RAM" value={specs.performance.ram} icon={<Cpu className="h-4 w-4" />} />
              <SpecItem label="Stockage" value={specs.performance.storage} />
              <SpecItem label="Carte graphique" value={specs.performance.gpu} />
            </CardContent>
          </Card>
        )}

        {/* Display */}
        {(specs.display.size || specs.display.resolution) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Monitor className="h-5 w-5" />
                Écran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Taille" value={specs.display.size} />
              <SpecItem label="Résolution" value={specs.display.resolution} />
              <SpecItem label="Type" value={specs.display.type} />
              <SpecItem label="Taux de rafraîchissement" value={specs.display.refresh_rate} />
            </CardContent>
          </Card>
        )}

        {/* Connectivity */}
        {(specs.connectivity.bluetooth || specs.connectivity.wifi || specs.connectivity.usb) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wifi className="h-5 w-5" />
                Connectivité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Bluetooth" value={specs.connectivity.bluetooth} />
              <SpecItem label="Wi-Fi" value={specs.connectivity.wifi} />
              <SpecItem label="USB" value={specs.connectivity.usb} />
              {specs.connectivity.ports && (
                <div className="pt-2">
                  <span className="text-sm text-muted-foreground">Ports:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.isArray(specs.connectivity.ports) ? (
                      specs.connectivity.ports.map((port: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{port}</Badge>
                      ))
                    ) : (
                      <span className="text-sm">{specs.connectivity.ports}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Battery */}
        {(specs.battery.capacity || specs.battery.type || specs.battery.life) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Battery className="h-5 w-5" />
                Batterie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Capacité" value={specs.battery.capacity} />
              <SpecItem label="Type" value={specs.battery.type} />
              <SpecItem label="Autonomie" value={specs.battery.life} />
            </CardContent>
          </Card>
        )}

        {/* Sensor Details (for cameras/phones) */}
        {specs.sensor && Object.keys(specs.sensor).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5" />
                Capteur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <SpecItem label="Type" value={specs.sensor.type} />
              <SpecItem label="Résolution" value={specs.sensor.resolution} />
              <SpecItem label="Taille" value={specs.sensor.size} />
              <SpecItem label="ISO" value={specs.sensor.iso_range} />
              <SpecItem label="Ouverture" value={specs.sensor.aperture} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Compatibility Section */}
      {analysis?.analysis_result?.compatibility && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compatibilité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.analysis_result.compatibility.compatible_with && (
              <div>
                <span className="font-medium text-sm text-muted-foreground mb-2 block">
                  Compatible avec:
                </span>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(analysis.analysis_result.compatibility.compatible_with) ? (
                    analysis.analysis_result.compatibility.compatible_with.map((item: string, i: number) => (
                      <Badge key={i} variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                        ✓ {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm">{analysis.analysis_result.compatibility.compatible_with}</span>
                  )}
                </div>
              </div>
            )}
            {analysis.analysis_result.compatibility.not_compatible_with && (
              <div>
                <span className="font-medium text-sm text-muted-foreground mb-2 block">
                  Non compatible avec:
                </span>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(analysis.analysis_result.compatibility.not_compatible_with) ? (
                    analysis.analysis_result.compatibility.not_compatible_with.map((item: string, i: number) => (
                      <Badge key={i} variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400">
                        ✗ {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm">{analysis.analysis_result.compatibility.not_compatible_with}</span>
                  )}
                </div>
              </div>
            )}
            {analysis.analysis_result.compatibility.regional_restrictions && (
              <div>
                <span className="font-medium text-sm text-muted-foreground mb-2 block">
                  Restrictions régionales:
                </span>
                <p className="text-sm text-muted-foreground">
                  {analysis.analysis_result.compatibility.regional_restrictions}
                </p>
              </div>
            )}
            {analysis?.analysis_result?.compatible_lenses && Array.isArray(analysis.analysis_result.compatible_lenses) && analysis.analysis_result.compatible_lenses.length > 0 && (
              <div>
                <span className="font-medium text-sm text-muted-foreground mb-2 block">
                  Objectifs compatibles:
                </span>
                <div className="flex flex-wrap gap-2">
                  {analysis.analysis_result.compatible_lenses.map((lens: string, i: number) => (
                    <Badge key={i} variant="outline">{lens}</Badge>
                  ))}
                </div>
              </div>
            )}
            {analysis?.analysis_result?.accessories && Array.isArray(analysis.analysis_result.accessories) && analysis.analysis_result.accessories.length > 0 && (
              <div>
                <span className="font-medium text-sm text-muted-foreground mb-2 block">
                  Accessoires:
                </span>
                <div className="flex flex-wrap gap-2">
                  {analysis.analysis_result.accessories.map((accessory: string, i: number) => (
                    <Badge key={i} variant="outline">{accessory}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advanced Technical Details Accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détails techniques avancés</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {analysis?.analysis_result?.performance && (
              <AccordionItem value="performance">
                <AccordionTrigger>Performance détaillée</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(analysis.analysis_result.performance).map(([key, value]: [string, any]) => (
                      <SpecItem 
                        key={key} 
                        label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                        value={typeof value === 'object' ? JSON.stringify(value) : value} 
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            
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
