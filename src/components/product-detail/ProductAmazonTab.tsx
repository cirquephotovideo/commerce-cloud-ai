import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, RefreshCw, ExternalLink, TrendingUp, Ruler, Image as ImageIcon, DollarSign, Users, Edit, Save, X } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ProductAmazonTabProps {
  analysis: any;
}

export const ProductAmazonTab = ({ analysis }: ProductAmazonTabProps) => {
  const { toast } = useToast();
  const [amazonData, setAmazonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  const loadAmazonData = async () => {
    try {
      const { data, error } = await supabase
        .from('amazon_product_data')
        .select('*')
        .eq('analysis_id', analysis.id)
        .maybeSingle();

      if (error) throw error;
      setAmazonData(data);
      if (data) {
        const itemDims = data.item_dimensions as any;
        const packageDims = data.package_dimensions as any;
        setEditedData({
          ean: data.ean || '',
          asin: data.asin || '',
          title: data.title || '',
          brand: data.brand || '',
          part_number: data.part_number || '',
          manufacturer: data.manufacturer || '',
          product_type: data.product_type || '',
          features: Array.isArray(data.features) ? data.features.join('\n') : '',
          item_weight: data.item_weight || '',
          item_height: itemDims?.height?.value || '',
          item_width: itemDims?.width?.value || '',
          item_length: itemDims?.length?.value || '',
          package_weight: data.package_weight || '',
          package_height: packageDims?.height?.value || '',
          package_width: packageDims?.width?.value || '',
          package_length: packageDims?.length?.value || '',
          images: Array.isArray(data.images) ? data.images.map((img: any) => img.url || img).join('\n') : '',
        });
      }
    } catch (error: any) {
      console.error('Error loading Amazon data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAmazonData();
  }, [analysis.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-product-enrichment', {
        body: { analysis_id: analysis.id }
      });

      if (error) throw error;

      toast({
        title: "✅ Données actualisées",
        description: "Les informations Amazon ont été mises à jour",
      });

      await loadAmazonData();
    } catch (error: any) {
      // Si 403, demander de vérifier la configuration AWS
      if (error?.status === 403) {
        toast({
          title: "⚠️ Erreur de configuration AWS",
          description: "Vérifiez vos credentials AWS dans Admin → API Keys",
          variant: "destructive",
        });
      }
      // Si 404, afficher un message neutre (produit introuvable)
      else if (error?.status === 404) {
        toast({
          title: "ℹ️ Produit introuvable",
          description: "Ce produit n'a pas été trouvé sur Amazon.",
        });
      } else {
        toast({
          title: "❌ Erreur",
          description: error.message || "Impossible de récupérer les données Amazon.",
          variant: "destructive",
        });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!amazonData?.id) return;

    try {
      const updateData: any = {
        ean: editedData.ean,
        asin: editedData.asin,
        title: editedData.title,
        brand: editedData.brand,
        part_number: editedData.part_number,
        manufacturer: editedData.manufacturer,
        product_type: editedData.product_type,
        features: editedData.features.split('\n').filter((f: string) => f.trim()),
        item_weight: editedData.item_weight ? parseFloat(editedData.item_weight) : null,
        package_weight: editedData.package_weight ? parseFloat(editedData.package_weight) : null,
      };

      // Update dimensions
      if (editedData.item_height || editedData.item_width || editedData.item_length) {
        updateData.item_dimensions = {
          height: editedData.item_height ? { value: parseFloat(editedData.item_height), unit: 'cm' } : null,
          width: editedData.item_width ? { value: parseFloat(editedData.item_width), unit: 'cm' } : null,
          length: editedData.item_length ? { value: parseFloat(editedData.item_length), unit: 'cm' } : null,
        };
      }

      if (editedData.package_height || editedData.package_width || editedData.package_length) {
        updateData.package_dimensions = {
          height: editedData.package_height ? { value: parseFloat(editedData.package_height), unit: 'cm' } : null,
          width: editedData.package_width ? { value: parseFloat(editedData.package_width), unit: 'cm' } : null,
          length: editedData.package_length ? { value: parseFloat(editedData.package_length), unit: 'cm' } : null,
        };
      }

      // Update images
      if (editedData.images) {
        const imageUrls = editedData.images.split('\n').filter((url: string) => url.trim());
        updateData.images = imageUrls.map((url: string) => ({ url: url.trim() }));
      }

      const { error } = await supabase
        .from('amazon_product_data')
        .update(updateData)
        .eq('id', amazonData.id);

      if (error) throw error;

      toast({
        title: "✅ Sauvegardé",
        description: "Les modifications ont été enregistrées",
      });

      setIsEditing(false);
      await loadAmazonData();
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de sauvegarder les modifications",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    loadAmazonData();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!amazonData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune donnée Amazon</CardTitle>
          <CardDescription>
            Ce produit n'a pas encore été enrichi avec les données Amazon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Cliquez sur le bouton "Enrichir avec Amazon Seller" dans l'onglet Aperçu pour synchroniser les données.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasImages = amazonData.images && Array.isArray(amazonData.images) && amazonData.images.length > 0;
  const hasSalesRank = amazonData.sales_rank && Array.isArray(amazonData.sales_rank) && amazonData.sales_rank.length > 0;
  const hasFeatures = amazonData.features && Array.isArray(amazonData.features) && amazonData.features.length > 0;

  return (
    <div className="space-y-6">
      {/* Header avec boutons refresh et edit */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Données Amazon Seller</h3>
          <p className="text-sm text-muted-foreground">
            Dernière synchronisation : {new Date(amazonData.last_synced_at).toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSaveEdits} size="sm" variant="default">
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder
              </Button>
              <Button onClick={handleCancelEdit} size="sm" variant="outline">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Éditer
              </Button>
              <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Informations Générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">ASIN</Label>
              {isEditing ? (
                <Input
                  value={editedData.asin}
                  onChange={(e) => setEditedData({ ...editedData, asin: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded">{amazonData.asin}</code>
                  <a 
                    href={`https://www.amazon.fr/dp/${amazonData.asin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Voir sur Amazon
                  </a>
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">EAN</Label>
              {isEditing ? (
                <Input
                  value={editedData.ean}
                  onChange={(e) => setEditedData({ ...editedData, ean: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="text-sm mt-1">{amazonData.ean || 'N/A'}</p>
              )}
            </div>
            {amazonData.upc && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">UPC</span>
                <p className="text-sm mt-1">{amazonData.upc}</p>
              </div>
            )}
            {(amazonData.part_number || isEditing) && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Numéro de pièce</Label>
                {isEditing ? (
                  <Input
                    value={editedData.part_number}
                    onChange={(e) => setEditedData({ ...editedData, part_number: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1">{amazonData.part_number}</p>
                )}
              </div>
            )}
          </div>

          {(amazonData.title || isEditing) && (
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Titre Amazon</Label>
              {isEditing ? (
                <Textarea
                  value={editedData.title}
                  onChange={(e) => setEditedData({ ...editedData, title: e.target.value })}
                  className="mt-1"
                  rows={2}
                />
              ) : (
                <p className="text-sm mt-1">{amazonData.title}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {(amazonData.brand || isEditing) && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Marque</Label>
                {isEditing ? (
                  <Input
                    value={editedData.brand}
                    onChange={(e) => setEditedData({ ...editedData, brand: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1">{amazonData.brand}</p>
                )}
              </div>
            )}
            {(amazonData.manufacturer || isEditing) && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Fabricant</Label>
                {isEditing ? (
                  <Input
                    value={editedData.manufacturer}
                    onChange={(e) => setEditedData({ ...editedData, manufacturer: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1">{amazonData.manufacturer}</p>
                )}
              </div>
            )}
            {(amazonData.product_type || isEditing) && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Type de produit</Label>
                {isEditing ? (
                  <Input
                    value={editedData.product_type}
                    onChange={(e) => setEditedData({ ...editedData, product_type: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1">{amazonData.product_type}</p>
                )}
              </div>
            )}
            {amazonData.marketplace && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Marketplace</span>
                <p className="text-sm mt-1">{amazonData.marketplace}</p>
              </div>
            )}
            {amazonData.variation_count > 0 && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Nombre de variations</span>
                <p className="text-sm mt-1">{amazonData.variation_count}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prix */}
      {(amazonData.list_price || amazonData.buy_box_price || amazonData.lowest_new_price) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Prix et Offres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {amazonData.list_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Prix de liste</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.list_price} €</p>
                </div>
              )}
              {amazonData.buy_box_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Buy Box Neuf</span>
                  <p className="text-lg font-semibold mt-1 text-primary">{amazonData.buy_box_price} €</p>
                </div>
              )}
              {amazonData.amazon_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Prix Amazon</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.amazon_price} €</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-4">
              {amazonData.lowest_new_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Plus bas Neuf</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.lowest_new_price} €</p>
                </div>
              )}
              {amazonData.fba_new_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">FBA Neuf</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.fba_new_price} €</p>
                </div>
              )}
              {amazonData.lowest_collectible_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Plus bas Collection</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.lowest_collectible_price} €</p>
                </div>
              )}
              {amazonData.lowest_refurbished_price && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Plus bas Remis à neuf</span>
                  <p className="text-lg font-semibold mt-1">{amazonData.lowest_refurbished_price} €</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 text-sm text-muted-foreground">
              {amazonData.offer_count_new > 0 && (
                <span>• {amazonData.offer_count_new} offre(s) neuf</span>
              )}
              {amazonData.offer_count_collectible > 0 && (
                <span>• {amazonData.offer_count_collectible} offre(s) collection</span>
              )}
              {amazonData.offer_count_refurbished > 0 && (
                <span>• {amazonData.offer_count_refurbished} offre(s) remis à neuf</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images Amazon */}
      {(hasImages || isEditing) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Images Amazon {!isEditing && `(${amazonData.images.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">URLs des images (une par ligne)</Label>
                <Textarea
                  value={editedData.images}
                  onChange={(e) => setEditedData({ ...editedData, images: e.target.value })}
                  className="mt-2"
                  rows={5}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>
            ) : (
              <Carousel className="w-full max-w-3xl mx-auto">
                <CarouselContent>
                  {amazonData.images.map((img: any, index: number) => (
                    img.url && (
                      <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                        <div className="p-1">
                          <Card>
                            <CardContent className="flex aspect-square items-center justify-center p-2">
                              <img 
                                src={img.url} 
                                alt={`Amazon image ${index + 1}`}
                                className="object-contain w-full h-full"
                              />
                            </CardContent>
                          </Card>
                          {img.variant && (
                            <p className="text-xs text-center text-muted-foreground mt-1">
                              {img.variant}
                            </p>
                          )}
                        </div>
                      </CarouselItem>
                    )
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dimensions */}
      {(amazonData.item_dimensions || amazonData.package_dimensions) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(amazonData.item_dimensions || isEditing) && (
              <div>
                <h4 className="text-sm font-medium mb-2">Article</h4>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Longueur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.item_length}
                        onChange={(e) => setEditedData({ ...editedData, item_length: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.item_dimensions?.length?.value || 'N/A'} {amazonData.item_dimensions?.length?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Largeur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.item_width}
                        onChange={(e) => setEditedData({ ...editedData, item_width: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.item_dimensions?.width?.value || 'N/A'} {amazonData.item_dimensions?.width?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Hauteur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.item_height}
                        onChange={(e) => setEditedData({ ...editedData, item_height: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.item_dimensions?.height?.value || 'N/A'} {amazonData.item_dimensions?.height?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Poids (kg)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.item_weight}
                        onChange={(e) => setEditedData({ ...editedData, item_weight: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.item_weight || 'N/A'} kg</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(amazonData.package_dimensions || isEditing) && (
              <div>
                <h4 className="text-sm font-medium mb-2">Emballage</h4>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Longueur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.package_length}
                        onChange={(e) => setEditedData({ ...editedData, package_length: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.package_dimensions?.length?.value || 'N/A'} {amazonData.package_dimensions?.length?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Largeur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.package_width}
                        onChange={(e) => setEditedData({ ...editedData, package_width: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.package_dimensions?.width?.value || 'N/A'} {amazonData.package_dimensions?.width?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Hauteur (cm)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.package_height}
                        onChange={(e) => setEditedData({ ...editedData, package_height: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.package_dimensions?.height?.value || 'N/A'} {amazonData.package_dimensions?.height?.unit || ''}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Poids (kg)</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedData.package_weight}
                        onChange={(e) => setEditedData({ ...editedData, package_weight: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{amazonData.package_weight || 'N/A'} kg</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Rank */}
      {hasSalesRank && (
        <Card>
          <CardHeader>
            <CardTitle>Classement des Ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {amazonData.sales_rank.map((rank: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm">{rank.category}</span>
                  <Badge variant="secondary">#{rank.rank}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      {(hasFeatures || isEditing) && (
        <Card>
          <CardHeader>
            <CardTitle>Caractéristiques Produit (Bullet Points)</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Caractéristiques (une par ligne)</Label>
                <Textarea
                  value={editedData.features}
                  onChange={(e) => setEditedData({ ...editedData, features: e.target.value })}
                  className="mt-2"
                  rows={6}
                  placeholder="Entrez chaque caractéristique sur une nouvelle ligne"
                />
              </div>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {amazonData.features.map((feature: string, index: number) => (
                  <li key={index} className="text-sm">{feature}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buy Box Information */}
      {(amazonData.buy_box_seller_id || amazonData.buy_box_seller_name) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Informations Buy Box
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {amazonData.buy_box_seller_id && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">ID du vendeur</span>
                  <p className="text-sm mt-1 font-mono">{amazonData.buy_box_seller_id}</p>
                </div>
              )}
              {amazonData.buy_box_seller_name && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Nom du vendeur</span>
                  <p className="text-sm mt-1">{amazonData.buy_box_seller_name}</p>
                </div>
              )}
              {amazonData.buy_box_ship_country && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Pays d'expédition</span>
                  <p className="text-sm mt-1">{amazonData.buy_box_ship_country}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              {amazonData.is_buy_box_amazon_fulfilled !== null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">FBA</span>
                  <Badge variant={amazonData.is_buy_box_amazon_fulfilled ? "default" : "secondary"} className="mt-1">
                    {amazonData.is_buy_box_amazon_fulfilled ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              )}
              {amazonData.is_buy_box_amazon_seller !== null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Vendu par Amazon</span>
                  <Badge variant={amazonData.is_buy_box_amazon_seller ? "default" : "secondary"} className="mt-1">
                    {amazonData.is_buy_box_amazon_seller ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              )}
              {amazonData.is_buy_box_preorder !== null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Précommande</span>
                  <Badge variant={amazonData.is_buy_box_preorder ? "default" : "secondary"} className="mt-1">
                    {amazonData.is_buy_box_preorder ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              )}
              {amazonData.is_buy_box_out_of_stock !== null && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Rupture de stock</span>
                  <Badge variant={amazonData.is_buy_box_out_of_stock ? "destructive" : "default"} className="mt-1">
                    {amazonData.is_buy_box_out_of_stock ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Browse Nodes (Catégories) */}
      {amazonData.browse_nodes && Array.isArray(amazonData.browse_nodes) && amazonData.browse_nodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Catégories Amazon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {amazonData.browse_nodes.map((node: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-sm">{node.contextFreeName || node.displayName}</p>
                  {node.id && (
                    <p className="text-xs text-muted-foreground mt-1">ID: {node.id}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Détails supplémentaires */}
      <Card>
        <CardHeader>
          <CardTitle>Détails Supplémentaires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {amazonData.color && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Couleur</span>
                <p className="text-sm mt-1">{amazonData.color}</p>
              </div>
            )}
            {amazonData.size && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Taille</span>
                <p className="text-sm mt-1">{amazonData.size}</p>
              </div>
            )}
            {amazonData.package_quantity && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Quantité/paquet</span>
                <p className="text-sm mt-1">{amazonData.package_quantity}</p>
              </div>
            )}
            {amazonData.item_count && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Nombre d'articles</span>
                <p className="text-sm mt-1">{amazonData.item_count}</p>
              </div>
            )}
            {amazonData.page_count && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Nombre de pages</span>
                <p className="text-sm mt-1">{amazonData.page_count}</p>
              </div>
            )}
            {amazonData.publication_date && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Date de publication</span>
                <p className="text-sm mt-1">{amazonData.publication_date}</p>
              </div>
            )}
            {amazonData.release_date && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Date de sortie</span>
                <p className="text-sm mt-1">{amazonData.release_date}</p>
              </div>
            )}
            {amazonData.is_trade_in_eligible !== null && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Éligible à l'échange</span>
                <Badge variant={amazonData.is_trade_in_eligible ? "default" : "secondary"} className="mt-1">
                  {amazonData.is_trade_in_eligible ? 'Oui' : 'Non'}
                </Badge>
              </div>
            )}
            {amazonData.referral_fee_percentage && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Commission de référence</span>
                <p className="text-sm mt-1">{amazonData.referral_fee_percentage}%</p>
              </div>
            )}
            {amazonData.prep_pack_fees && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Frais de préparation</span>
                <p className="text-sm mt-1">{amazonData.prep_pack_fees} €</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contributors */}
      {amazonData.contributors && Array.isArray(amazonData.contributors) && amazonData.contributors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contributeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {amazonData.contributors.map((contributor: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-sm">{contributor.value}</p>
                  {contributor.type && contributor.type !== 'unknown' && (
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{contributor.type}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
