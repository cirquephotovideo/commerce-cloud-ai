import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package, Euro, TrendingUp, Calendar, Link2, Search, Sparkles, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupplierProductDetailProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchSimilar?: (product: any) => void;
  onEnrichWithWeb?: (product: any) => void;
}

export function SupplierProductDetail({ product, open, onOpenChange, onSearchSimilar, onEnrichWithWeb }: SupplierProductDetailProps) {
  const hasLink = product.product_links && product.product_links.length > 0;
  const additionalData = product.additional_data || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {product.product_name}
            </span>
            {hasLink ? (
              <Badge className="bg-green-600 text-white">
                <Link2 className="h-3 w-3 mr-1" />
                Lié
              </Badge>
            ) : (
              <Badge variant="secondary">Non lié</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations principales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">EAN</div>
              <div className="font-mono text-sm">
                {product.ean || <span className="text-muted-foreground italic">Non disponible</span>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Référence Fournisseur</div>
              <div className="font-mono text-sm">
                {product.supplier_reference || <span className="text-muted-foreground italic">N/A</span>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Euro className="h-4 w-4" />
                Prix d'achat
              </div>
              <div className="text-lg font-semibold">
                {product.purchase_price} {product.currency}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Stock disponible
              </div>
              <div className="text-lg font-semibold">
                {product.stock_quantity || <span className="text-muted-foreground">N/A</span>}
              </div>
            </div>
          </div>

          {/* Informations détaillées depuis additional_data */}
          {(additionalData.brand || additionalData.category || additionalData.vat_rate || additionalData.manufacturer_ref) && (
            <div className="space-y-3 p-4 bg-secondary/20 rounded-lg border border-secondary">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informations Détaillées
              </div>
              <div className="grid grid-cols-2 gap-3">
                {additionalData.brand && additionalData.brand !== product.supplier_reference && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Marque</span>
                    <Badge variant="outline" className="font-medium w-full justify-start">
                      {additionalData.brand}
                    </Badge>
                  </div>
                )}
                {additionalData.manufacturer_ref && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Réf. Fabricant</span>
                    <Badge variant="outline" className="font-medium w-full justify-start font-mono text-xs">
                      {additionalData.manufacturer_ref}
                    </Badge>
                  </div>
                )}
                {additionalData.category && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Catégorie</span>
                    <Badge variant="secondary" className="font-medium w-full justify-start">
                      {additionalData.category}
                    </Badge>
                  </div>
                )}
                {additionalData.vat_rate && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">TVA</span>
                    <Badge className="font-medium w-full justify-start">
                      {additionalData.vat_rate}%
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description enrichie */}
          {product.description && (
            <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-sm font-medium text-foreground">Description</div>
              <ScrollArea className="h-32">
                <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
              </ScrollArea>
            </div>
          )}

          {/* Specs techniques */}
          {additionalData.specs && additionalData.specs.length > 0 && (
            <div className="space-y-2 p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div className="text-sm font-medium text-foreground">Spécifications Techniques</div>
              <ul className="space-y-1 text-sm">
                {additionalData.specs.map((spec: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <span className="text-muted-foreground">{spec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions avancées */}
          {(onSearchSimilar || onEnrichWithWeb) && (
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Actions Avancées</div>
              {onSearchSimilar && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onSearchSimilar(product)}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Rechercher dans les Autres Fournisseurs
                </Button>
              )}
              {onEnrichWithWeb && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => onEnrichWithWeb(product)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrichir avec Web Search
                </Button>
              )}
            </div>
          )}

          {/* Fournisseur */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium text-muted-foreground">Fournisseur</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{product.supplier_configurations?.supplier_name}</span>
              {product.supplier_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(product.supplier_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir sur le site
                </Button>
              )}
            </div>
          </div>

          {/* Métadonnées */}
          {product.metadata && Object.keys(product.metadata).length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Informations supplémentaires</div>
              <div className="p-4 bg-muted rounded-lg">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(product.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Créé le {format(new Date(product.created_at), "dd MMM yyyy", { locale: fr })}
            </div>
            {product.updated_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Mis à jour le {format(new Date(product.updated_at), "dd MMM yyyy", { locale: fr })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
