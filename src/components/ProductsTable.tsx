import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Eye, Truck, Loader2 } from "lucide-react";
import { formatPrice, formatMargin, getMarginColor, getStatusVariant, extractAnalysisData, getImageUrl } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnrichmentBadges } from "@/components/product-detail/EnrichmentBadges";

interface ProductsTableProps {
  products: any[];
  selectedProducts: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onViewDetails: (id: string) => void;
  showCreateAnalysisAction?: boolean;
  onCreateAnalysis?: (product: any) => void;
  enrichingProductIds?: Set<string>;
}

type SortField = 'name' | 'ean' | 'supplier' | 'purchase_price' | 'estimated_price' | 'margin' | 'category';
type SortDirection = 'asc' | 'desc';

export function ProductsTable({ 
  products, 
  selectedProducts, 
  onToggleSelection, 
  onSelectAll,
  onViewDetails,
  showCreateAnalysisAction = false,
  onCreateAnalysis,
  enrichingProductIds = new Set()
}: ProductsTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Query pour récupérer le nombre de fournisseurs liés par produit
  const { data: suppliersCount } = useQuery({
    queryKey: ['suppliers-count', products.map(p => p.id)],
    queryFn: async () => {
      if (!products.length) return {};
      
      // Récupérer tous les analysis_id
      const analysisIds = products
        .filter(p => p.linked_analysis_id)
        .map(p => p.linked_analysis_id);
      
      if (!analysisIds.length) return {};

      const { data, error } = await supabase
        .from('product_links')
        .select('analysis_id, supplier_product_id')
        .in('analysis_id', analysisIds);

      if (error) throw error;

      // Compter par analysis_id
      const counts: Record<string, number> = {};
      data?.forEach(link => {
        counts[link.analysis_id] = (counts[link.analysis_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: products.length > 0,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    const aData = extractAnalysisData(a);
    const bData = extractAnalysisData(b);
    
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = (a.product_name || '').localeCompare(b.product_name || '');
        break;
      case 'ean':
        comparison = (a.ean || '').localeCompare(b.ean || '');
        break;
      case 'supplier':
        comparison = (a.supplier_configurations?.supplier_name || '').localeCompare(
          b.supplier_configurations?.supplier_name || ''
        );
        break;
      case 'purchase_price':
        comparison = (a.purchase_price || 0) - (b.purchase_price || 0);
        break;
      case 'estimated_price':
        comparison = (aData.estimatedPrice || 0) - (bData.estimatedPrice || 0);
        break;
      case 'margin':
        comparison = (aData.margin || 0) - (bData.margin || 0);
        break;
      case 'category':
        comparison = (aData.category || '').localeCompare(bData.category || '');
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button 
      variant="ghost" 
      size="sm"
      className="h-8 font-semibold"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 sm:w-12 sticky left-0 bg-background z-10">
              <Checkbox 
                checked={selectedProducts.size === products.length && products.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="w-12 sm:w-16"></TableHead>
            <TableHead className="min-w-[150px]">
              <SortButton field="name">Nom</SortButton>
            </TableHead>
            <TableHead className="min-w-[100px]">
              <SortButton field="ean">EAN</SortButton>
            </TableHead>
            <TableHead className="min-w-[120px]">
              <SortButton field="supplier">Fournisseur</SortButton>
            </TableHead>
            <TableHead className="text-right min-w-[100px]">
              <SortButton field="purchase_price">Prix Achat</SortButton>
            </TableHead>
            <TableHead className="text-right min-w-[100px]">
              <SortButton field="estimated_price">Prix Vente</SortButton>
            </TableHead>
            <TableHead className="text-right min-w-[80px]">
              <SortButton field="margin">Marge</SortButton>
            </TableHead>
            <TableHead className="min-w-[120px]">
              <SortButton field="category">Catégorie</SortButton>
            </TableHead>
            <TableHead className="text-right min-w-[80px] sticky right-0 bg-background z-10">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => {
            const { margin, estimatedPrice, category, imageCount } = extractAnalysisData(product);
            const imageUrl = getImageUrl(product);
            const supplierCount = suppliersCount?.[product.linked_analysis_id] || 0;
            
            return (
              <TableRow key={product.id}>
                <TableCell className="sticky left-0 bg-background z-10">
                  <Checkbox 
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => onToggleSelection(product.id)}
                  />
                </TableCell>
                <TableCell>
                  <img 
                    src={imageUrl} 
                    alt={product.product_name}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[300px]">
                  <div className="space-y-1">
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:underline"
                      onClick={() => onViewDetails(product.id)}
                    >
                      {product.product_name}
                      {supplierCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Truck className="h-3 w-3 mr-1" />
                          {supplierCount}
                        </Badge>
                      )}
                    </div>
                    <EnrichmentBadges
                      enrichmentStatus={{
                        images: {
                          status: imageCount > 0 ? 'available' : 'missing',
                          count: imageCount
                        },
                        video: {
                          status: product.product_videos?.length > 0 ? 'available' : 'missing'
                        },
                        amazon: {
                          status: product.amazon_enriched_at ? 'available' : 'missing'
                        },
                        description: {
                          status: product.ai_generated_description ? 'available' : 'missing'
                        },
                        rsgp: {
                          status: product.rsgp_compliance ? 'available' : 'missing'
                        },
                        specs: {
                          status: product.technical_specs ? 'available' : 'missing'
                        }
                      }}
                      onBadgeClick={(type) => onViewDetails(product.id)}
                      compact
                    />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {product.ean || 'N/A'}
                </TableCell>
                <TableCell className="text-sm">
                  {product.supplier_configurations?.supplier_name || 'N/A'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(product.purchase_price)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(estimatedPrice)}
                </TableCell>
                <TableCell className="text-right">
                  {margin !== undefined ? (
                    <Badge variant={getMarginColor(margin)}>
                      {formatMargin(margin)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">N/A</span>
                  )}
                </TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">
                  {category || 'N/A'}
                </TableCell>
                <TableCell className="text-right sticky right-0 bg-background z-10">
                  {showCreateAnalysisAction && !product.product_analyses ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onCreateAnalysis?.(product)}
                      disabled={enrichingProductIds.has(product.id)}
                    >
                      {enrichingProductIds.has(product.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Créer analyse"
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onViewDetails(product.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
