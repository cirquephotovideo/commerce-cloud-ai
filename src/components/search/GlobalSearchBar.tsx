import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GlobalSearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  resultCount?: number;
}

export const GlobalSearchBar = ({ 
  onSearch, 
  isLoading = false, 
  placeholder = "Rechercher par EAN, SKU, nom de produit...",
  resultCount 
}: GlobalSearchBarProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce pour éviter trop de requêtes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // Appeler onSearch quand la query debounced change
  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery("");
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-10 h-12 text-base",
            "border-2 focus:border-primary",
            "transition-all duration-200"
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
        )}
        {!isLoading && query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Compteur de résultats */}
      {resultCount !== undefined && query && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {resultCount} résultat{resultCount !== 1 ? 's' : ''}
          </Badge>
          {query && (
            <span>pour "{query}"</span>
          )}
        </div>
      )}

      {/* Shortcut hint */}
      {!query && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">K</kbd>
          <span>pour rechercher rapidement</span>
        </div>
      )}
    </div>
  );
};
