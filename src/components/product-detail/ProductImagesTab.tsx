import { ProductImageGallery } from "@/components/ProductImageGallery";
import { ThemedImageGenerator } from "@/components/ThemedImageGenerator";
import { getProductImages, getProductName } from "@/lib/analysisDataExtractors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductImagesTabProps {
  analysis: any;
}

export const ProductImagesTab = ({ analysis }: ProductImagesTabProps) => {
  const images = getProductImages(analysis);
  const productName = getProductName(analysis);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Galerie d'Images</CardTitle>
          <CardDescription>
            {images.length} image{images.length > 1 ? "s" : ""} disponible{images.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductImageGallery images={images} productName={productName} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Générateur d'Images IA</CardTitle>
          <CardDescription>
            Créez de nouvelles images thématiques pour ce produit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemedImageGenerator productName={productName} />
        </CardContent>
      </Card>
    </div>
  );
};
