import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sparkles, Upload, Package, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice, formatMargin, getMarginColor, formatDate, extractAnalysisData } from "@/lib/formatters";
import { useState } from "react";

interface ProductDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onExport?: (platform: string) => void;
  onEnrich?: () => void;
}

export function ProductDetailModal({ 
  open, 
  onOpenChange, 
  product,
  onExport,
  onEnrich
}: ProductDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  if (!product) return null;

  const { 
    analysis, 
    margin, 
    estimatedPrice, 
    category, 
    imageUrls,
    imageCount,
    ranking 
  } = extractAnalysisData(product);

  const analysisResult = analysis?.analysis_result as any;
  const amazonData = analysisResult?.amazon_data;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {product.product_name}
            </span>
            <div className="flex gap-2">
              {onEnrich && (
                <Button size="sm" variant="outline" onClick={onEnrich}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Enrichir
                </Button>
              )}
              {onExport && analysis && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Upload className="w-4 h-4 mr-1" />
                      Exporter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onExport('shopify')}>
                      Shopify
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('woocommerce')}>
                      WooCommerce
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('prestashop')}>
                      PrestaShop
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('magento')}>
                      Magento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('odoo')}>
                      Odoo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="images">
              Images ({imageCount})
            </TabsTrigger>
            <TabsTrigger value="amazon">Amazon</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="supplier">Fournisseur</TabsTrigger>
            <TabsTrigger value="raw">Données brutes</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[600px] mt-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Prix d'achat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPrice(product.purchase_price)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Prix de vente estimé
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPrice(estimatedPrice)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Marge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={getMarginColor(margin)} className="text-lg">
                      {formatMargin(margin)}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Informations produit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">EAN</p>
                      <p className="font-medium">{product.ean || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Catégorie</p>
                      <p className="font-medium">{category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Marque</p>
                      <p className="font-medium">{analysisResult?.brand || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stock</p>
                      <p className="font-medium">{product.stock_quantity || 'N/A'}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-sm">
                      {analysisResult?.description || 'Aucune description disponible'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-4">
              {imageUrls.length > 0 ? (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="relative">
                        <img
                          src={imageUrls[currentImageIndex]}
                          alt={`Image ${currentImageIndex + 1}`}
                          className="w-full h-96 object-contain rounded"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                        {imageUrls.length > 1 && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="absolute left-2 top-1/2 -translate-y-1/2"
                              onClick={prevImage}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2"
                              onClick={nextImage}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="text-center mt-4 text-sm text-muted-foreground">
                        Image {currentImageIndex + 1} / {imageUrls.length}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-6 gap-2">
                    {imageUrls.map((url: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`border-2 rounded p-1 transition-all ${
                          index === currentImageIndex
                            ? 'border-primary'
                            : 'border-transparent hover:border-muted-foreground'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full aspect-square object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune image disponible</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Amazon Tab */}
            <TabsContent value="amazon" className="space-y-4">
              {amazonData ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Données Amazon</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">ASIN</p>
                          <p className="font-medium">{amazonData.asin || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Ranking</p>
                          <p className="font-medium">
                            {ranking ? `Top ${ranking}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Prix Amazon</p>
                          <p className="font-medium">
                            {formatPrice(amazonData.price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Nombre d'avis</p>
                          <p className="font-medium">{amazonData.reviews_count || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune donnée Amazon disponible</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Analyse des prix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prix d'achat</span>
                      <span className="font-medium">
                        {formatPrice(product.purchase_price)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prix de vente estimé</span>
                      <span className="font-medium">
                        {formatPrice(estimatedPrice)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">Marge</span>
                      <Badge variant={getMarginColor(margin)} className="text-lg">
                        {formatMargin(margin)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Supplier Tab */}
            <TabsContent value="supplier" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informations fournisseur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Fournisseur</p>
                      <p className="font-medium">
                        {product.supplier_configurations?.supplier_name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Référence</p>
                      <p className="font-medium">{product.supplier_reference || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stock disponible</p>
                      <p className="font-medium">{product.stock_quantity || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Délai de livraison</p>
                      <p className="font-medium">
                        {product.delivery_time_days 
                          ? `${product.delivery_time_days} jours` 
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Quantité minimum</p>
                      <p className="font-medium">
                        {product.minimum_order_quantity || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Importé le</p>
                      <p className="font-medium">{formatDate(product.created_at)}</p>
                    </div>
                  </div>

                  {product.supplier_url && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">URL fournisseur</p>
                        <a
                          href={product.supplier_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {product.supplier_url}
                        </a>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Données brutes (JSON)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-[500px]">
                    {JSON.stringify(
                      {
                        supplier_product: product,
                        analysis: analysis,
                      },
                      null,
                      2
                    )}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
