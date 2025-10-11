import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sparkles, Upload, Package, ImageIcon, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { formatPrice, formatMargin, getMarginColor, formatDate, extractAnalysisData } from "@/lib/formatters";
import { useState } from "react";
import { SupplierPriceHistory } from "./SupplierPriceHistory";
import { SupplierPricesCard } from "./SupplierPricesCard";
import { DetailedAnalysisView } from "./DetailedAnalysisView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

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
  
  const reEnrichMutation = useMutation({
    mutationFn: async (provider: string = 'lovable-ai') => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      const { data, error } = await supabase.functions.invoke('re-enrich-product', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          productId: product.id,
          enrichmentTypes: ['amazon', 'ai_analysis'],
          provider
        }
      });

      if (error) {
        // Handle specific error codes
        if (error.message.includes('401')) {
          throw new Error('Session expirée, veuillez vous reconnecter');
        }
        if (error.message.includes('429')) {
          throw new Error('Limite de taux atteinte, veuillez réessayer plus tard');
        }
        if (error.message.includes('402')) {
          throw new Error('Crédits insuffisants, veuillez recharger votre compte');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Re-enrichissement démarré avec succès !');
      if (onEnrich) onEnrich(); // Refresh parent
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors du re-enrichissement : ${error.message}`);
    },
  });

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
              {product.id && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => reEnrichMutation.mutate('lovable-ai')}
                  disabled={reEnrichMutation.isPending}
                >
                  {reEnrichMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Re-enrichissement...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      Re-enrichir
                    </>
                  )}
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
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="images">
              Images ({imageCount})
            </TabsTrigger>
            <TabsTrigger value="amazon">Amazon</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="supplier">Fournisseur</TabsTrigger>
            <TabsTrigger value="supplier-prices">Prix Fournisseurs</TabsTrigger>
            <TabsTrigger value="detailed">🔍 Analyse Complète</TabsTrigger>
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
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground w-[200px]">
                          EAN
                        </TableCell>
                        <TableCell>{product.ean || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Référence fournisseur
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {product.supplier_reference || 'N/A'}
                          </code>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Catégorie
                        </TableCell>
                        <TableCell>{category || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Statut enrichissement
                        </TableCell>
                        <TableCell>
                          {typeof product.enrichment_status === 'object' && product.enrichment_status !== null ? (
                            <div className="flex gap-1">
                              {product.enrichment_status.rsgp && (
                                <Badge variant="outline" className="text-xs">
                                  RSGP: {product.enrichment_status.rsgp}
                                </Badge>
                              )}
                              {product.enrichment_status.heygen && (
                                <Badge variant="outline" className="text-xs">
                                  HeyGen: {product.enrichment_status.heygen}
                                </Badge>
                              )}
                              {!product.enrichment_status.rsgp && !product.enrichment_status.heygen && (
                                <Badge variant="outline">Non enrichi</Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">
                              {typeof product.enrichment_status === 'string' 
                                ? product.enrichment_status 
                                : 'Non enrichi'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Marque
                        </TableCell>
                        <TableCell>{analysisResult?.brand || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Stock
                        </TableCell>
                        <TableCell>{product.stock_quantity || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Separator className="my-4" />

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-muted-foreground font-medium">Description</p>
                      {(() => {
                        const desc = analysisResult?.description?.suggested_description || 
                                    analysisResult?.description_long || 
                                    product.description || '';
                        const isTruncated = desc.endsWith('...') || desc.includes('jusqu&') || desc.length < 50;
                        return isTruncated ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Description incomplète
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-sm">
                      {analysisResult?.description?.suggested_description || 
                       analysisResult?.description_long ||
                       product.description || 
                       'Aucune description disponible'}
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
                      <CardTitle>Informations détaillées Amazon</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">ASIN</p>
                          <p className="font-mono text-sm">{amazonData.asin || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">UPC</p>
                          <p className="font-mono text-sm">{amazonData.upc || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Ranking</p>
                          <p className="font-medium">
                            {ranking ? `Top ${ranking}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avis clients</p>
                          <p className="font-medium">
                            ⭐ {amazonData.rating || 'N/A'} ({amazonData.reviews_count || 0} avis)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Prix Amazon</p>
                          <p className="font-medium">
                            {formatPrice(amazonData.buy_box_price || amazonData.price)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Prix le plus bas (neuf)</p>
                          <p className="font-medium text-green-600">
                            {formatPrice(amazonData.lowest_new_price)}
                          </p>
                        </div>
                        {amazonData.list_price && (
                          <>
                            <div>
                              <p className="text-sm text-muted-foreground">Prix de liste</p>
                              <p className="font-medium">{formatPrice(amazonData.list_price)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Offres neuves</p>
                              <p className="font-medium">{amazonData.offer_count_new || 0} vendeurs</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dimensions & Poids */}
                  {(amazonData.item_dimensions || amazonData.item_weight) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Dimensions & Poids</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {amazonData.item_dimensions && (
                            <div>
                              <p className="text-sm text-muted-foreground">Dimensions produit</p>
                              <p className="text-sm">
                                {amazonData.item_dimensions.length} × {amazonData.item_dimensions.width} × {amazonData.item_dimensions.height} cm
                              </p>
                            </div>
                          )}
                          {amazonData.item_weight && (
                            <div>
                              <p className="text-sm text-muted-foreground">Poids</p>
                              <p className="text-sm">{amazonData.item_weight} kg</p>
                            </div>
                          )}
                          {amazonData.package_dimensions && (
                            <div>
                              <p className="text-sm text-muted-foreground">Dimensions colis</p>
                              <p className="text-sm">
                                {amazonData.package_dimensions.length} × {amazonData.package_dimensions.width} × {amazonData.package_dimensions.height} cm
                              </p>
                            </div>
                          )}
                          {amazonData.package_weight && (
                            <div>
                              <p className="text-sm text-muted-foreground">Poids colis</p>
                              <p className="text-sm">{amazonData.package_weight} kg</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
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
              {/* Price Comparator Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Analyse des prix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Prix d'achat fournisseur:</span>
                      <span className="font-bold text-lg">{formatPrice(product.purchase_price)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Prix recommandé (IA):</span>
                      <span className="font-bold text-lg text-green-600">{formatPrice(estimatedPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Marge potentielle:</span>
                      <Badge variant={getMarginColor(margin)} className="text-base">
                        {formatMargin(margin)}
                      </Badge>
                    </div>
                    {analysisResult?.market_average_price && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Prix moyen marché:</span>
                          <span>{formatPrice(analysisResult.market_average_price)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Supplier Info Card */}
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
                      <p className="text-sm text-muted-foreground">Dernière MAJ</p>
                      <p className="font-medium">{formatDate(product.updated_at || product.created_at)}</p>
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

              {/* Actions fournisseur */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions fournisseur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.functions.invoke('supplier-sync-single-product', {
                          body: { productId: product.id }
                        });
                        
                        if (error) throw error;
                        toast.success('Produit mis à jour depuis le fournisseur !');
                        if (onEnrich) onEnrich(); // Refresh
                      } catch (error: any) {
                        toast.error(`Erreur: ${error.message}`);
                      }
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Mettre à jour depuis le fournisseur
                  </Button>
                </CardContent>
              </Card>

              {/* Price History */}
              {product.supplier_product_id && (
                <SupplierPriceHistory supplierProductId={product.supplier_product_id} />
              )}
            </TabsContent>

            {/* Detailed Analysis Tab */}
            <TabsContent value="detailed" className="space-y-4">
              {/* Re-enrichment Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Enrichir le produit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Relancez l'enrichissement avec le fournisseur IA de votre choix
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => reEnrichMutation.mutate('lovable-ai')}
                      disabled={reEnrichMutation.isPending}
                      variant="default"
                    >
                      {reEnrichMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          En cours...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Lovable AI (Recommandé)
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => reEnrichMutation.mutate('ollama')}
                      disabled={reEnrichMutation.isPending}
                      variant="outline"
                    >
                      Ollama
                    </Button>
                    <Button
                      onClick={() => reEnrichMutation.mutate('openai')}
                      disabled={reEnrichMutation.isPending}
                      variant="outline"
                    >
                      OpenAI
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis View */}
              <DetailedAnalysisView analysis={analysis} />
            </TabsContent>

            {/* Supplier Prices Tab */}
            <TabsContent value="supplier-prices" className="space-y-4">
              <SupplierPricesCard productAnalysisId={analysis?.id || ''} />
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Données brutes (JSON)</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const dataStr = JSON.stringify({
                          supplier_product: product,
                          analysis: analysis,
                          amazon_data: amazonData
                        }, null, 2);
                        navigator.clipboard.writeText(dataStr);
                        toast.success('JSON copié dans le presse-papier !');
                      }}
                    >
                      📋 Copier JSON
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="product">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="product">Produit fournisseur</TabsTrigger>
                      <TabsTrigger value="analysis">Analyse IA</TabsTrigger>
                      <TabsTrigger value="amazon">Données Amazon</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="product">
                      <ScrollArea className="h-[450px]">
                        <pre className="text-xs bg-muted p-4 rounded">
                          {JSON.stringify(product, null, 2)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="analysis">
                      <ScrollArea className="h-[450px]">
                        <pre className="text-xs bg-muted p-4 rounded">
                          {JSON.stringify(analysisResult, null, 2)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="amazon">
                      <ScrollArea className="h-[450px]">
                        <pre className="text-xs bg-muted p-4 rounded">
                          {JSON.stringify(amazonData || {}, null, 2)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
