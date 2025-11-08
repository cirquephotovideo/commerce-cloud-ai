import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductFiltersBar } from "@/components/products/ProductFiltersBar";
import { ProductStats } from "@/components/products/ProductStats";
import { BulkActionsBar } from "@/components/products/BulkActionsBar";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function ProductsManagement() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    supplier: 'all',
    priceRange: [0, 10000] as [number, number],
    enrichmentStatus: 'all',
    sortBy: 'created_at',
    sortDirection: 'desc' as 'asc' | 'desc'
  });

  // Fetch products with filters
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products-management', filters, currentPage, itemsPerPage],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('product_analyses')
        .select(`
          *,
          supplier_products!left(
            id,
            purchase_price,
            currency,
            supplier_id,
            supplier_configurations!left(
              supplier_name
            )
          )
        `, { count: 'exact' })
        .eq('user_id', user.id);

      // Apply search filter
      if (filters.search) {
        query = query.or(`
          analysis_result->>product_name.ilike.%${filters.search}%,
          ean.ilike.%${filters.search}%
        `);
      }

      // Apply category filter
      if (filters.category !== 'all') {
        query = query.eq('mapped_category_name', filters.category);
      }

      // Apply enrichment status filter
      if (filters.enrichmentStatus === 'amazon') {
        query = query.not('amazon_enrichment_status', 'is', null);
      } else if (filters.enrichmentStatus === 'not_enriched') {
        query = query.is('amazon_enrichment_status', null);
      }

      // Apply sorting
      query = query.order(filters.sortBy, { ascending: filters.sortDirection === 'asc' });

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { products: data || [], total: count || 0 };
    }
  });

  const products = productsData?.products || [];
  const totalProducts = productsData?.total || 0;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleSelectProduct = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleViewProduct = (product: any) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Produits</h1>
          <p className="text-muted-foreground">
            Gérez vos produits, enrichissements et exports
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Produit
        </Button>
      </div>

      {/* Stats */}
      <ProductStats products={products} totalProducts={totalProducts} />

      {/* Filters */}
      <ProductFiltersBar filters={filters} onFiltersChange={setFilters} />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
          onRefresh={handleRefresh}
        />
      )}

      {/* Products List */}
      <div className="space-y-2">
        {/* Select All */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === products.length && products.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm font-medium">
              Sélectionner tout
            </span>
          </label>
          <div className="text-sm text-muted-foreground">
            {totalProducts} produit{totalProducts > 1 ? 's' : ''}
          </div>
        </div>

        {/* Products */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <p className="text-muted-foreground">
              Aucun produit trouvé avec ces filtres
            </p>
          </div>
        ) : (
          products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={selectedIds.has(product.id)}
              onSelect={() => handleSelectProduct(product.id)}
              onView={() => handleViewProduct(product)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const page = i + 1;
              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          product={selectedProduct}
          onEnrich={handleRefresh}
        />
      )}
    </div>
  );
}
