import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ProductFiltersBarProps {
  filters: {
    search: string;
    category: string;
    supplier: string;
    priceRange: [number, number];
    enrichmentStatus: string;
    sortBy: string;
    sortDirection: 'asc' | 'desc';
  };
  onFiltersChange: (filters: any) => void;
}

export function ProductFiltersBar({ filters, onFiltersChange }: ProductFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: searchValue });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  return (
    <div className="space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, EAN, référence..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <Select
          value={filters.category}
          onValueChange={(value) => onFiltersChange({ ...filters, category: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            <SelectItem value="Électronique">Électronique</SelectItem>
            <SelectItem value="Informatique">Informatique</SelectItem>
            <SelectItem value="Mode">Mode</SelectItem>
            <SelectItem value="Maison">Maison</SelectItem>
          </SelectContent>
        </Select>

        {/* Enrichment Status */}
        <Select
          value={filters.enrichmentStatus}
          onValueChange={(value) => onFiltersChange({ ...filters, enrichmentStatus: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Enrichissement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="amazon">✓ Amazon</SelectItem>
            <SelectItem value="rsgp">✓ RSGP</SelectItem>
            <SelectItem value="video">🎥 Vidéo</SelectItem>
            <SelectItem value="not_enriched">⚠️ Non enrichis</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date de création</SelectItem>
            <SelectItem value="analysis_result->>product_name">Nom A-Z</SelectItem>
            <SelectItem value="purchase_price">Prix croissant</SelectItem>
            <SelectItem value="margin_percentage">Marge %</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtres avancés
        </Button>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvanced}>
        <CollapsibleContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            {/* Price Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">Plage de prix</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange[0]}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    priceRange: [Number(e.target.value), filters.priceRange[1]]
                  })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange[1]}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    priceRange: [filters.priceRange[0], Number(e.target.value)]
                  })}
                />
              </div>
            </div>

            {/* Sort Direction */}
            <div>
              <label className="text-sm font-medium mb-2 block">Direction du tri</label>
              <Select
                value={filters.sortDirection}
                onValueChange={(value: 'asc' | 'desc') => 
                  onFiltersChange({ ...filters, sortDirection: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Croissant</SelectItem>
                  <SelectItem value="desc">Décroissant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Fournisseur</label>
              <Select
                value={filters.supplier}
                onValueChange={(value) => onFiltersChange({ ...filters, supplier: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les fournisseurs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
