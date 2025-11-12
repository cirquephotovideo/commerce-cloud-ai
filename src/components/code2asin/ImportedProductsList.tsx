import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon } from "lucide-react";
import { Code2AsinDetailDialog } from "./Code2AsinDetailDialog";
import { startOfDay, endOfDay } from "date-fns";

interface ImportedProductsListProps {
  userId: string;
  importDate?: Date;
}

export const ImportedProductsList = ({ userId, importDate }: ImportedProductsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState(100);

  const { data: products, isLoading } = useQuery({
    queryKey: ['code2asin-imported-products', userId, importDate, displayLimit],
    queryFn: async () => {
      let query = supabase
        .from('code2asin_enrichments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(displayLimit);
      
      if (importDate) {
        query = query
          .gte('created_at', startOfDay(importDate).toISOString())
          .lte('created_at', endOfDay(importDate).toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Filtrage et tri
  const filteredProducts = products?.filter((product: any) => {
    const search = searchTerm.toLowerCase();
    return (
      product.title?.toLowerCase().includes(search) ||
      product.ean?.toLowerCase().includes(search) ||
      product.asin?.toLowerCase().includes(search)
    );
  });

  const sortedProducts = filteredProducts?.sort((a: any, b: any) => {
    switch (sortBy) {
      case 'price-asc':
        return (a.buybox_price || 0) - (b.buybox_price || 0);
      case 'price-desc':
        return (b.buybox_price || 0) - (a.buybox_price || 0);
      case 'alpha':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="aspect-square mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres */}
      <div className="flex gap-4">
        <Input 
          placeholder="Rechercher par titre, EAN ou ASIN..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date d'import</SelectItem>
            <SelectItem value="price-asc">Prix croissant</SelectItem>
            <SelectItem value="price-desc">Prix décroissant</SelectItem>
            <SelectItem value="alpha">Alphabétique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Compteur de résultats */}
      {sortedProducts && (
        <p className="text-sm text-muted-foreground">
          {sortedProducts.length} produit{sortedProducts.length > 1 ? 's' : ''} trouvé{sortedProducts.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Grille de produits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedProducts?.map((product: any) => {
          const images = product.image_urls;
          const mainImage = Array.isArray(images) ? images[0] : null;

          return (
            <Card 
              key={product.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => setSelectedProduct(product)}
            >
              <CardContent className="p-4">
                {/* Image */}
                <div className="aspect-square relative mb-3 bg-muted rounded-lg overflow-hidden">
                  {mainImage ? (
                    <img 
                      src={mainImage} 
                      alt={product.title || 'Produit'}
                      className="object-contain w-full h-full group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info produit */}
                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2 min-h-[3rem] text-sm">
                    {product.title || 'Sans titre'}
                  </h3>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    {product.asin && (
                      <p>ASIN: <span className="font-mono">{product.asin}</span></p>
                    )}
                    {product.ean && (
                      <p>EAN: <span className="font-mono">{product.ean}</span></p>
                    )}
                  </div>

                  {/* Prix */}
                  {product.buybox_price && (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl font-bold text-primary">
                        {product.buybox_price.toFixed(2)}€
                      </span>
                      {product.buybox_is_fba && (
                        <Badge variant="outline" className="text-xs">FBA</Badge>
                      )}
                      {product.buybox_is_amazon && (
                        <Badge variant="secondary" className="text-xs">Amazon</Badge>
                      )}
                    </div>
                  )}

                  {/* Marque */}
                  {product.brand && (
                    <p className="text-sm text-muted-foreground truncate">
                      {product.brand}
                    </p>
                  )}

                  {/* Offres */}
                  {product.offer_count_new > 0 && (
                    <Badge variant="default" className="text-xs">
                      {product.offer_count_new} offre{product.offer_count_new > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pas de résultats */}
      {sortedProducts?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun produit trouvé</p>
        </div>
      )}

      {/* Load more button */}
      {products && products.length >= displayLimit && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={() => setDisplayLimit(prev => prev + 100)}
          >
            Charger 100 produits supplémentaires
          </Button>
        </div>
      )}

      {/* Modal détail */}
      <Code2AsinDetailDialog 
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};