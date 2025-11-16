import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearchBar } from "@/components/search/GlobalSearchBar";
import { QuickActionsMenu } from "@/components/search/QuickActionsMenu";
import { SearchResults } from "@/components/search/SearchResults";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ProductDetailModal } from "@/components/ProductDetailModal";

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

export default function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Recherche dans supplier_products
      const { data: supplierProducts, error: spError } = await supabase
        .from('supplier_products')
        .select(`
          id,
          product_name,
          ean,
          supplier_reference,
          purchase_price,
          stock_quantity,
          enrichment_status,
          supplier_configurations(name)
        `)
        .eq('user_id', user.id)
        .or(`product_name.ilike.%${query}%,ean.ilike.%${query}%,supplier_reference.ilike.%${query}%`)
        .range(0, 49)
        .order('created_at', { ascending: false });

      if (spError) throw spError;

      // Recherche dans product_analyses
      const { data: analyses, error: paError } = await supabase
        .from('product_analyses')
        .select(`
          id,
          ean,
          analysis_result,
          image_urls,
          enrichment_status
        `)
        .eq('user_id', user.id)
        .or(`ean.ilike.%${query}%`)
        .range(0, 49)
        .order('created_at', { ascending: false });

      if (paError) throw paError;

      // Recherche dans code2asin_enrichments
      const { data: code2asin, error: c2aError } = await supabase
        .from('code2asin_enrichments')
        .select(`
          id,
          ean,
          title,
          asin,
          buybox_price,
          image_urls
        `)
        .eq('user_id', user.id)
        .or(`ean.ilike.%${query}%,title.ilike.%${query}%,asin.ilike.%${query}%`)
        .range(0, 49)
        .order('created_at', { ascending: false });

      if (c2aError) throw c2aError;

      // Formater les résultats
      const formattedSupplierProducts: SearchResult[] = (supplierProducts || []).map(sp => ({
        id: sp.id,
        name: sp.product_name,
        ean: sp.ean || undefined,
        supplier_reference: sp.supplier_reference || undefined,
        purchase_price: sp.purchase_price || undefined,
        stock_quantity: sp.stock_quantity || undefined,
        enrichment_status: sp.enrichment_status || undefined,
        supplier_name: (sp.supplier_configurations as any)?.name || undefined,
        type: 'supplier_product' as const,
      }));

      const formattedAnalyses: SearchResult[] = (analyses || []).map(pa => ({
        id: pa.id,
        name: (pa.analysis_result as any)?.name || (pa.analysis_result as any)?.description || 'Produit analysé',
        ean: pa.ean || undefined,
        image_url: pa.image_urls?.[0] || undefined,
        enrichment_status: typeof pa.enrichment_status === 'string' ? pa.enrichment_status : undefined,
        type: 'product_analysis' as const,
      }));

      const formattedCode2Asin: SearchResult[] = (code2asin || []).map(c2a => {
        let imageUrl: string | undefined = undefined;
        if (Array.isArray(c2a.image_urls) && c2a.image_urls.length > 0) {
          const firstImage = c2a.image_urls[0];
          imageUrl = typeof firstImage === 'string' ? firstImage : undefined;
        }
        
        return {
          id: c2a.id,
          name: c2a.title || 'Produit Amazon',
          ean: c2a.ean || undefined,
          purchase_price: c2a.buybox_price || undefined,
          image_url: imageUrl,
          type: 'code2asin' as const,
        };
      });

      const allResults = [
        ...formattedSupplierProducts,
        ...formattedAnalyses,
        ...formattedCode2Asin
      ];

      setResults(allResults);

      if (allResults.length === 0) {
        toast({
          title: "Aucun résultat",
          description: `Aucun produit trouvé pour "${query}"`,
          variant: "default",
        });
      }

    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Erreur de recherche",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    performSearch(query);
  }, [performSearch]);

  const handleViewDetails = async (result: SearchResult) => {
    try {
      if (result.type === 'supplier_product') {
        // Récupérer les détails complets du produit fournisseur
        const { data } = await supabase
          .from('supplier_products')
          .select('*, product_links(analysis_id)')
          .eq('id', result.id)
          .single();

        if (data?.product_links?.[0]?.analysis_id) {
          // Si lié à une analyse, ouvrir le modal avec product
          setSelectedResult(data);
          setIsModalOpen(true);
        } else {
          toast({
            title: "Produit non lié",
            description: "Ce produit n'est pas encore lié à une analyse",
          });
        }
      } else if (result.type === 'product_analysis') {
        // Récupérer d'abord le produit lié
        const { data: links } = await supabase
          .from('product_links')
          .select('supplier_product_id')
          .eq('analysis_id', result.id)
          .limit(1);

        if (links && links.length > 0) {
          const { data: product } = await supabase
            .from('supplier_products')
            .select('*')
            .eq('id', links[0].supplier_product_id)
            .single();

          setSelectedResult(product);
          setIsModalOpen(true);
        } else {
          toast({
            title: "Produit non trouvé",
            description: "Impossible de trouver le produit associé",
          });
        }
      } else {
        toast({
          title: "Type non supporté",
          description: "Affichage des détails Code2ASIN non disponible pour le moment",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredResults = activeTab === 'all' 
    ? results 
    : results.filter(r => r.type === activeTab);

  const counts = {
    all: results.length,
    supplier_product: results.filter(r => r.type === 'supplier_product').length,
    product_analysis: results.filter(r => r.type === 'product_analysis').length,
    code2asin: results.filter(r => r.type === 'code2asin').length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔍 Recherche Globale</h1>
          <p className="text-muted-foreground">
            Recherchez parmi tous vos produits, analyses et enrichissements
          </p>
        </div>
        <QuickActionsMenu />
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche Universelle</CardTitle>
          <CardDescription>
            Recherchez par EAN, SKU, référence fournisseur, nom de produit, ASIN...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GlobalSearchBar
            onSearch={handleSearch}
            isLoading={isSearching}
            resultCount={filteredResults.length}
          />
        </CardContent>
      </Card>

      {/* Onglets de filtrage */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="gap-2">
            Tous
            <Badge variant="secondary">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="supplier_product" className="gap-2">
            📦 Fournisseurs
            <Badge variant="secondary">{counts.supplier_product}</Badge>
          </TabsTrigger>
          <TabsTrigger value="product_analysis" className="gap-2">
            🔍 Analyses
            <Badge variant="secondary">{counts.product_analysis}</Badge>
          </TabsTrigger>
          <TabsTrigger value="code2asin" className="gap-2">
            🏷️ Code2ASIN
            <Badge variant="secondary">{counts.code2asin}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <SearchResults
            results={filteredResults}
            isLoading={isSearching}
            onViewDetails={handleViewDetails}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de détails */}
      {selectedResult && (
        <ProductDetailModal
          product={selectedResult}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onEnrich={() => {
            // Rafraîchir les résultats après enrichissement
            if (searchQuery) {
              performSearch(searchQuery);
            }
          }}
        />
      )}
    </div>
  );
}
