import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Package, Euro, TrendingUp, Calendar, Link2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SupplierProductDetailProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierProductDetail({ product, open, onOpenChange }: SupplierProductDetailProps) {
  const hasLink = product.product_links && product.product_links.length > 0;

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
