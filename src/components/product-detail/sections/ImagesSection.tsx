import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, Download, Trash2, Sparkles, Loader2 } from "lucide-react";
import { MediaGalleryUnified } from "../MediaGalleryUnified";
import { useEnrichment } from "@/hooks/useEnrichment";

interface ImagesSectionProps {
  analysis: any;
  onEnrich?: () => void;
}

export const ImagesSection = ({ analysis, onEnrich }: ImagesSectionProps) => {
  // Vérification de sécurité
  if (!analysis?.id) {
    return null;
  }
  
  const enrichMutation = useEnrichment(analysis.id, onEnrich);
  
  const analysisImages = Array.isArray(analysis?.image_urls) ? analysis.image_urls : [];
  const amazonData = analysis?.amazon_product_data || null;
  const amazonImages = amazonData && Array.isArray(amazonData.images) ? amazonData.images : [];
  const aiGeneratedImages = Array.isArray(analysis?.generated_images) ? analysis.generated_images : [];
  
  const totalImages = analysisImages.length + (Array.isArray(amazonImages) ? amazonImages.length : 0) + aiGeneratedImages.length;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Images ({totalImages} disponibles)
        </CardTitle>
        <CardDescription>
          Images provenant de différentes sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Galerie unifiée */}
        <MediaGalleryUnified images={[
          ...analysisImages.map((url: string) => ({ url, source: 'analysis' as const })),
          ...(Array.isArray(amazonImages) ? amazonImages.map((url: string) => ({ url, source: 'amazon' as const })) : []),
          ...aiGeneratedImages.map((url: string) => ({ url, source: 'ai' as const }))
        ]} />

        {/* Statistiques par source */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">🔍 Analyse initiale</div>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline">{analysisImages.length} images</Badge>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                👁️
              </Button>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">📦 Amazon</div>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline">
                {Array.isArray(amazonImages) ? amazonImages.length : 0} images
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                👁️
              </Button>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">🎨 IA générées</div>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline">{aiGeneratedImages.length} images</Badge>
              <Button 
                size="sm" 
                variant="default" 
                className="h-6 gap-1 px-2"
                onClick={() => enrichMutation.mutate({ enrichmentType: ['images'] })}
                disabled={enrichMutation.isPending}
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Générer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-3 w-3" />
            Télécharger tout
          </Button>
          <Button size="sm" variant="outline" className="gap-2 text-destructive">
            <Trash2 className="h-3 w-3" />
            Supprimer sélection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
