import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon } from 'lucide-react';

interface MediaGalleryUnifiedProps {
  images: Array<{
    url: string;
    source: 'analysis' | 'amazon' | 'ai';
    alt?: string;
  }>;
}

export const MediaGalleryUnified = ({ images }: MediaGalleryUnifiedProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📸 Galerie d'Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground opacity-50 mb-3" />
            <p className="text-sm text-muted-foreground">Aucune image disponible</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentImage = images[currentIndex];

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'analysis':
        return <Badge variant="default">🔍 Analyse</Badge>;
      case 'amazon':
        return <Badge variant="secondary">📦 Amazon</Badge>;
      case 'ai':
        return <Badge className="bg-purple-600 text-white">🎨 IA</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `product-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>📸 Galerie d'Images ({images.length})</CardTitle>
          {getSourceBadge(currentImage.source)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image principale */}
        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
          <img
            src={currentImage.url}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            className="w-full h-full object-contain"
          />
          
          {/* Contrôles de navigation */}
          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={prevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={nextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Indicateur de position */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs font-medium">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(currentImage.url, '_blank')}
          >
            Ouvrir dans un nouvel onglet
          </Button>
        </div>

        {/* Miniatures */}
        {images.length > 1 && (
          <div className="grid grid-cols-6 gap-2">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-primary scale-105'
                    : 'border-transparent hover:border-muted-foreground'
                }`}
              >
                <img
                  src={img.url}
                  alt={`Miniature ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
