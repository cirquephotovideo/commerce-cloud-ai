import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Package, DollarSign, ExternalLink } from "lucide-react";
import { useState } from "react";

interface SearchResult {
  id: string;
  name: string;
  ean?: string;
  supplier_reference?: string;
  purchase_price?: number;
  stock_quantity?: number;
  enrichment_status?: string;
  supplier_name?: string;
  image_url?: string;
  type: 'supplier_product' | 'product_analysis' | 'code2asin';
}

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  onViewDetails: (result: SearchResult) => void;
}

export const SearchResults = ({ results, isLoading, onViewDetails }: SearchResultsProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'date'>('name');

  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return (a.purchase_price || 0) - (b.purchase_price || 0);
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      default:
        return 0;
    }
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'enriching':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier_product':
        return '📦 Produit Fournisseur';
      case 'product_analysis':
        return '🔍 Analyse';
      case 'code2asin':
        return '🏷️ Code2ASIN';
      default:
        return '📄 Produit';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-20 bg-muted rounded" />
              <div className="h-8 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Aucun résultat trouvé</p>
          <p className="text-sm text-muted-foreground mt-2">
            Essayez une autre recherche ou vérifiez vos filtres
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tri */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('name')}
          >
            Nom
          </Button>
          <Button
            variant={sortBy === 'price' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('price')}
          >
            Prix
          </Button>
        </div>
      </div>

      {/* Grille de résultats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedResults.map((result) => (
          <Card key={result.id} className="hover:border-primary transition-colors group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                  {result.name || 'Sans nom'}
                </CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">
                  {getTypeLabel(result.type)}
                </Badge>
              </div>
              {result.supplier_name && (
                <p className="text-xs text-muted-foreground">
                  📍 {result.supplier_name}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Image */}
              {result.image_url && (
                <div className="w-full h-32 rounded-md overflow-hidden bg-muted">
                  <img 
                    src={result.image_url} 
                    alt={result.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Infos */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {result.ean && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">EAN:</span>
                    <Badge variant="secondary" className="ml-2 font-mono text-xs">
                      {result.ean}
                    </Badge>
                  </div>
                )}
                {result.purchase_price !== undefined && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-sm">{result.purchase_price.toFixed(2)}€</span>
                  </div>
                )}
                {result.stock_quantity !== undefined && (
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{result.stock_quantity} unités</span>
                  </div>
                )}
              </div>

              {/* Statut */}
              {result.enrichment_status && (
                <Badge className={getStatusColor(result.enrichment_status)}>
                  {result.enrichment_status}
                </Badge>
              )}

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                onClick={() => onViewDetails(result)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Voir détails
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
