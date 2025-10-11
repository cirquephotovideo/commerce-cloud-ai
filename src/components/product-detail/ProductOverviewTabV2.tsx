import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { extractAnalysisData } from '@/lib/analysisDataExtractors';
import { EnrichmentStatusBadges } from './EnrichmentStatusBadges';
import { LiveSupplierPriceCard } from './LiveSupplierPriceCard';
import { EnrichmentTimeline } from './EnrichmentTimeline';
import { MediaGalleryUnified } from './MediaGalleryUnified';
import { VideoPlayer } from './VideoPlayer';
import { Package, Euro, TrendingUp, Calendar } from 'lucide-react';

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
