import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Code2AsinDetailDialogProps {
  product: any;
  open: boolean;
  onClose: () => void;
}

export const Code2AsinDetailDialog = ({ product, open, onClose }: Code2AsinDetailDialogProps) => {
  if (!product) return null;

  const images = Array.isArray(product.image_urls) ? product.image_urls : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-6 w-6" />
            {product.title || 'Détails Code2ASIN'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] pr-4">
          <div className="space-y-6">
            {/* Galerie d'images */}
            {images.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-lg">📸 Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {images.map((url: string, i: number) => (
                    <img 
                      key={i}
                      src={url} 
                      alt={`${product.title} - ${i+1}`}
                      className="aspect-square object-contain bg-muted rounded-lg border"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Identifiants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🔖 Identifiants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailField label="ASIN" value={product.asin} mono />
                  <DetailField label="EAN" value={product.ean} mono />
                  <DetailField label="UPC" value={product.upc} mono />
                  <DetailField label="Part Number" value={product.part_number} mono />
                  <DetailField label="Marketplace" value={product.marketplace} />
                </div>
              </CardContent>
            </Card>

            {/* Informations produit */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📦 Informations produit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailField label="Titre" value={product.title} className="col-span-full" />
                  <DetailField label="Marque" value={product.brand} />
                  <DetailField label="Fabricant" value={product.manufacturer} />
                  <DetailField label="Groupe produit" value={product.product_group} />
                  <DetailField label="Type" value={product.product_type} />
                  <DetailField label="Couleur" value={product.color} />
                  <DetailField label="Taille" value={product.size} />
                  <DetailField label="Browse Nodes" value={product.browse_nodes} className="col-span-full" />
                  <DetailField label="Fonctionnalités" value={product.features} className="col-span-full" />
                </div>
              </CardContent>
            </Card>

            {/* Prix détaillés & Buy Box */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Prix & Buy Box</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Buy Box Section */}
                {product.buybox_price && (
                  <div className="mb-6 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Prix Buy Box Neuf</p>
                        <p className="text-3xl font-bold text-primary">{product.buybox_price.toFixed(2)}€</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {product.buybox_is_fba && <Badge variant="default">FBA</Badge>}
                        {product.buybox_is_amazon && <Badge variant="secondary">Amazon</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {product.buybox_seller_name && (
                        <div>
                          <p className="text-muted-foreground">Vendeur</p>
                          <p className="font-semibold">{product.buybox_seller_name}</p>
                        </div>
                      )}
                      {product.buybox_seller_id && (
                        <div>
                          <p className="text-muted-foreground">ID Vendeur</p>
                          <p className="font-mono text-xs">{product.buybox_seller_id}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <BooleanField label="Gérée par Amazon" value={product.buybox_is_fba} />
                      <BooleanField label="D'Amazon" value={product.buybox_is_amazon} />
                    </div>
                  </div>
                )}

                {/* Autres prix */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <PriceCard label="Prix Amazon" price={product.amazon_price} />
                  <PriceCard label="Prix Catalogue" price={product.list_price} />
                  <PriceCard label="FBA Min Neuf" price={product.lowest_fba_new} />
                  <PriceCard label="Min Neuf" price={product.lowest_new} />
                  <PriceCard label="Min Occasion" price={product.lowest_used} />
                  <PriceCard label="Min Collection" price={product.lowest_collectible} />
                  <PriceCard label="Min Reconditionné" price={product.lowest_refurbished} />
                </div>
              </CardContent>
            </Card>

            {/* Dimensions & Poids */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📏 Dimensions & Poids</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Article</h4>
                    <div className="space-y-2">
                      <DetailField 
                        label="Dimensions (L × l × H)" 
                        value={product.item_length_cm ? `${product.item_length_cm} × ${product.item_width_cm} × ${product.item_height_cm} cm` : null}
                      />
                      <DetailField label="Poids" value={product.item_weight_g ? `${product.item_weight_g} g` : null} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Emballage</h4>
                    <div className="space-y-2">
                      <DetailField 
                        label="Dimensions (L × l × H)" 
                        value={product.package_length_cm ? `${product.package_length_cm} × ${product.package_width_cm} × ${product.package_height_cm} cm` : null}
                      />
                      <DetailField label="Poids" value={product.package_weight_g ? `${product.package_weight_g} g` : null} />
                      <DetailField label="Quantité" value={product.package_quantity} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offres concurrentes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🏪 Offres concurrentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <OfferCard label="Neuf" count={product.offer_count_new} color="bg-green-50 dark:bg-green-950" />
                  <OfferCard label="Occasion" count={product.offer_count_used} color="bg-yellow-50 dark:bg-yellow-950" />
                  <OfferCard label="Collection" count={product.offer_count_collectible} color="bg-blue-50 dark:bg-blue-950" />
                  <OfferCard label="Reconditionné" count={product.offer_count_refurbished} color="bg-purple-50 dark:bg-purple-950" />
                </div>
              </CardContent>
            </Card>

            {/* Frais Amazon */}
            {(product.referral_fee_percentage || product.fulfillment_fee) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💵 Frais Amazon</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {product.referral_fee_percentage && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Commission référencement</p>
                        <p className="text-3xl font-bold">{product.referral_fee_percentage.toFixed(2)}%</p>
                      </div>
                    )}
                    {product.fulfillment_fee && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Frais logistique FBA</p>
                        <p className="text-3xl font-bold">{product.fulfillment_fee.toFixed(2)}€</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Métadonnées */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ℹ️ Métadonnées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Rangs de vente" value={product.sales_rank} className="col-span-full" />
                  <DetailField label="Nombre de variations" value={product.variation_count} />
                  <DetailField label="Nombre d'articles" value={product.item_count} />
                  <DetailField label="Nombre de pages" value={product.page_count} />
                  <BooleanField label="Éligible à l'échange" value={product.is_tradeable} />
                  <DetailField 
                    label="Date publication" 
                    value={product.publication_date ? format(new Date(product.publication_date), 'dd/MM/yyyy') : null}
                  />
                  <DetailField 
                    label="Date sortie" 
                    value={product.release_date ? format(new Date(product.release_date), 'dd/MM/yyyy') : null}
                  />
                  <DetailField 
                    label="Enrichi le" 
                    value={product.enriched_at ? format(new Date(product.enriched_at), 'dd/MM/yyyy HH:mm') : null}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// Composants helper
const DetailField = ({ label, value, mono = false, className = '' }: any) => {
  if (!value && value !== 0) return null;
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={mono ? 'font-mono text-sm' : 'font-medium'}>{value}</p>
    </div>
  );
};

const BooleanField = ({ label, value }: any) => {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
};

const PriceCard = ({ label, price }: any) => {
  if (!price && price !== 0) return null;
  return (
    <div className="p-3 rounded-lg bg-accent/50 border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{price.toFixed(2)}€</p>
    </div>
  );
};

const OfferCard = ({ label, count, color }: any) => {
  if (!count && count !== 0) return null;
  return (
    <div className={`p-4 rounded-lg border text-center ${color}`}>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-xs text-muted-foreground mt-1">offre{count > 1 ? 's' : ''}</p>
    </div>
  );
};