import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { Image as ImageIcon, Download, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "./ui/badge";
import { ThemedImageGenerator } from "./ThemedImageGenerator";

interface ProductImageGalleryProps {
  images: string[];
  productName?: string;
  imageSources?: string[];
}

export const ProductImageGallery = ({ images, productName, imageSources = [] }: ProductImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [allImages, setAllImages] = useState<string[]>(images || []);

  if (!images || images.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${productName || 'product'}-image-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur de téléchargement:', error);
    }
  };

  const validImages = allImages.filter(img => typeof img === 'string' && img.trim() !== '');

  const handleImageGenerated = (newImageUrl: string) => {
    setAllImages(prev => [newImageUrl, ...prev]);
    setCurrentIndex(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ImageIcon className="w-4 h-4" />
          Images ({validImages.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Galerie d'images - {productName || "Produit"}</span>
            <Badge variant="secondary">{currentIndex + 1} / {validImages.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* AI Image Generator */}
          <ThemedImageGenerator 
            productName={productName || "Produit"} 
            onImageGenerated={handleImageGenerated}
          />

          {/* Main Image */}
          <div className="relative aspect-[16/10] bg-muted rounded-lg overflow-hidden">
            <img
              src={validImages[currentIndex]}
              alt={`${productName || 'Product'} ${currentIndex + 1}`}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/800x600?text=Image+non+disponible';
              }}
            />
            
            {/* Image Source Badges */}
            {imageSources.length > 0 && (
              <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                {imageSources.includes('direct_scraping') && (
                  <Badge variant="default" className="bg-primary text-primary-foreground">
                    ✓ Site officiel
                  </Badge>
                )}
                {imageSources.includes('ollama_web_search') && (
                  <Badge variant="secondary">
                    🔍 IA Web Search
                  </Badge>
                )}
                {imageSources.includes('amazon') && (
                  <Badge variant="outline">
                    📦 Amazon
                  </Badge>
                )}
                {imageSources.includes('google_shopping') && (
                  <Badge variant="outline">
                    🛒 Google Shopping
                  </Badge>
                )}
              </div>
            )}
            
            {/* Navigation Arrows */}
            {validImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={handleNext}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {/* Download Button */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => handleDownload(validImages[currentIndex], currentIndex)}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Thumbnails */}
          {validImages.length > 1 && (
            <div className="grid grid-cols-6 gap-2">
              {validImages.map((url, index) => (
                <button
                  key={index}
                  className={`relative aspect-square rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
