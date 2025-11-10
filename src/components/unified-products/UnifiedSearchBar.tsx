import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UnifiedSearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

interface SearchResults {
  analyses: number;
  suppliers: number;
  code2asin: number;
}

export const UnifiedSearchBar = ({ query, onChange }: UnifiedSearchBarProps) => {
  const [results, setResults] = useState<SearchResults>({
    analyses: 0,
    suppliers: 0,
    code2asin: 0,
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ analyses: 0, suppliers: 0, code2asin: 0 });
      return;
    }

    const searchAll = async () => {
      setIsSearching(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const searchPattern = `%${query}%`;

        const [analyses, suppliers, code2asin] = await Promise.all([
          supabase
            .from("product_analyses")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .or(`analysis_result->>name.ilike.${searchPattern},ean.ilike.${searchPattern}`),

          supabase
            .from("supplier_products")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .or(`product_name.ilike.${searchPattern},ean.ilike.${searchPattern}`),

          supabase
            .from("code2asin_enrichments")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .or(`title.ilike.${searchPattern},ean.ilike.${searchPattern},asin.ilike.${searchPattern}`),
        ]);

        setResults({
          analyses: analyses.count || 0,
          suppliers: suppliers.count || 0,
          code2asin: code2asin.count || 0,
        });
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchAll, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="🔍 Rechercher par nom, EAN, ASIN dans toutes les bases..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>
      {query && query.length >= 2 && (
        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
          {isSearching ? (
            <span>Recherche en cours...</span>
          ) : (
            <>
              <span>
                📊 Analysés: <strong className="text-foreground">{results.analyses}</strong>
              </span>
              <span>
                📦 Fournisseurs: <strong className="text-foreground">{results.suppliers}</strong>
              </span>
              <span>
                🛒 Amazon: <strong className="text-foreground">{results.code2asin}</strong>
              </span>
            </>
          )}
        </div>
      )}
    </Card>
  );
};
