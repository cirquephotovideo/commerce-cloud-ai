import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Download, Package } from "lucide-react";

interface ProductCardProps {
  product: any;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
}

export function ProductCard({ product, isSelected, onSelect, onView }: ProductCardProps) {
  const analysisResult = product.analysis_result || {};
  const productName = analysisResult.product_name || product.name || 'Produit sans nom';
  const imageUrls = Array.isArray(product.image_urls) ? product.image_urls : [];
  const firstImage = imageUrls[0] || '/placeholder.svg';
  
  // Get supplier info
  const supplierProducts = Array.isArray(product.supplier_products) 
    ? product.supplier_products 
    : product.supplier_products 
      ? [product.supplier_products] 
      : [];
  const firstSupplier = supplierProducts[0];
  const purchasePrice = firstSupplier?.purchase_price || product.purchase_price || 0;
  const supplierName = firstSupplier?.supplier_configurations?.supplier_name || 'N/A';
  
  // Calculate margin
  const sellingPrice = analysisResult.selling_price || analysisResult.price || 0;
  const margin = purchasePrice > 0 && sellingPrice > 0 
    ? ((sellingPrice - purchasePrice) / purchasePrice * 100).toFixed(1)
    : null;

  // Enrichment status
  const hasAmazon = product.amazon_enrichment_status !== null;
  const hasRSGP = product.enrichment_status?.rsgp === 'completed';
  const hasVideo = product.enrichment_status?.heygen === 'completed';

  return (
    <div className={`
      flex items-start gap-4 p-4 rounded-lg border transition-all
      ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}
    `}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        className="mt-2 h-4 w-4 rounded border-input"
      />

      {/* Image */}
      <img
        src={firstImage}
        alt={productName}
        className="w-24 h-24 object-cover rounded border border-border"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/placeholder.svg';
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg truncate">{productName}</h3>
            {product.ean && (
              <p className="text-sm text-muted-foreground">EAN: {product.ean}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-primary">
              {purchasePrice.toFixed(2)}€
            </div>
            {margin && (
              <div className="text-sm text-muted-foreground">
                Marge: {margin}%
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {hasAmazon && (
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
              <Package className="h-3 w-3 mr-1" />
              Amazon
            </Badge>
          )}
          {hasRSGP && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/30">
              ✓ RSGP
            </Badge>
          )}
          {hasVideo && (
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
              🎥 Vidéo
            </Badge>
          )}
        </div>

        {/* Info Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {product.mapped_category_name && (
            <span>Catégorie: {product.mapped_category_name}</span>
          )}
          {supplierName !== 'N/A' && (
            <span>Fournisseur: {supplierName}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="h-4 w-4 mr-1" />
            Voir
          </Button>
          <Button size="sm" variant="outline" onClick={onView}>
            <Edit className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" />
            Exporter
          </Button>
        </div>
      </div>
    </div>
  );
}
