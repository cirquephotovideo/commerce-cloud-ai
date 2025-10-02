import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, TrendingUp, TrendingDown, ExternalLink, Star, Link2, AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleShoppingResult {
  id: string;
  title: string;
  price: number;
  currency: string;
  merchant: string;
  url: string;
  image?: string;
  description: string;
  availability: string;
  rating?: number;
  reviews_count?: number;
  source: string;
  scraped_at: string;
}

interface Statistics {
  total_found: number;
  average_price: string;
  lowest_price: number;
  highest_price: number;
  merchants: string[];
}

interface Metadata {
  provider: string;
  response_time_ms: number;
  saved_count: number;
}

export const GoogleShoppingAnalysis = () => {
  const { toast } = useToast();
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [results, setResults] = useState<GoogleShoppingResult[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; suggestion?: string; helpUrl?: string } | null>(null);

  const handleSearch = async (mode: 'name' | 'url') => {
    setErrorInfo(null);
    
    if (mode === 'name' && !productName.trim()) {
      toast({ title: "Erreur", description: "Entrez un nom de produit", variant: "destructive" });
      return;
    }
    
    if (mode === 'url' && !productUrl.trim()) {
      toast({ title: "Erreur", description: "Entrez une URL de produit", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('google-shopping-scraper', {
        body: mode === 'name' 
          ? { productName, maxResults: 10 }
          : { productUrl, maxResults: 1 }
      });

      if (error) {
        console.error('Function error:', error);
        
        // Gérer les erreurs spécifiques
        if (error.message?.includes('API désactivée') || error.message?.includes('not been used')) {
          setErrorInfo({
            message: data?.error || error.message,
            suggestion: data?.suggestion || "Configurez SERPER_API_KEY pour activer le fallback automatique",
            helpUrl: data?.helpUrl
          });
          toast({ 
            title: "API Google non disponible", 
            description: "Le système utilise automatiquement Serper.dev si configuré",
            variant: "default"
          });
        } else {
          toast({ 
            title: "Erreur de recherche", 
            description: error.message,
            variant: "destructive" 
          });
        }
        return;
      }

      if (!data.success) {
        setErrorInfo({
          message: data.error,
          suggestion: data.suggestion,
          helpUrl: data.helpUrl
        });
        toast({ 
          title: "Erreur", 
          description: data.error,
          variant: "destructive" 
        });
        return;
      }

      // Trier les résultats par prix croissant
      const sortedResults = (data.results || []).sort((a, b) => a.price - b.price);
      setResults(sortedResults);
      setStatistics(data.statistics || null);
      setMetadata(data.metadata || null);
      
      toast({ 
        title: "✅ Recherche terminée", 
        description: `${data.results?.length || 0} produits trouvés et enregistrés via ${data.metadata?.provider || 'inconnu'}`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({ 
        title: "Erreur", 
        description: "Erreur lors de la recherche",
        variant: "destructive" 
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge variant="default" className="bg-green-500">En Stock</Badge>;
      case 'limited':
        return <Badge variant="secondary">Stock Limité</Badge>;
      case 'out_of_stock':
        return <Badge variant="destructive">Rupture</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Recherche Google Shopping
          </CardTitle>
          <CardDescription>
            Comparez les prix de milliers de marchands en temps réel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorInfo && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{errorInfo.message}</p>
                  {errorInfo.suggestion && (
                    <p className="text-sm">{errorInfo.suggestion}</p>
                  )}
                  {errorInfo.helpUrl && (
                    <a 
                      href={errorInfo.helpUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm underline flex items-center gap-1"
                    >
                      Activer l'API <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label>Recherche par nom de produit</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: iPhone 15 Pro, Sony A7 IV, MacBook Pro..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch('name')}
                  className="flex-1"
                />
                <Button onClick={() => handleSearch('name')} disabled={isSearching}>
                  <Search className="w-4 h-4 mr-2" />
                  {isSearching ? "Recherche..." : "Rechercher"}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou
                </span>
              </div>
            </div>

            <div>
              <Label>Analyse depuis une URL directe</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.fnac.com/produit... ou Google Shopping URL"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch('url')}
                  className="flex-1"
                />
                <Button onClick={() => handleSearch('url')} disabled={isSearching} variant="secondary">
                  <Link2 className="w-4 h-4 mr-2" />
                  {isSearching ? "Analyse..." : "Analyser"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Fonctionne avec Google Shopping, Fnac, Darty, Amazon, etc.
              </p>
            </div>
          </div>

          {metadata && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground p-2 bg-accent/50 rounded">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {metadata.provider}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {metadata.response_time_ms}ms
              </div>
              <div className="flex items-center gap-1">
                💾 {metadata.saved_count} enregistrés
              </div>
            </div>
          )}

          {statistics && (
            <Card className="bg-accent/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Résultats</div>
                    <div className="text-2xl font-bold">{statistics.total_found}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Prix Moyen</div>
                    <div className="text-2xl font-bold">{statistics.average_price}€</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-green-500" />
                      Plus Bas
                    </div>
                    <div className="text-2xl font-bold text-green-500">{statistics.lowest_price}€</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-red-500" />
                      Plus Haut
                    </div>
                    <div className="text-2xl font-bold text-red-500">{statistics.highest_price}€</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">Marchands trouvés:</div>
                  <div className="flex flex-wrap gap-2">
                    {statistics.merchants.map((merchant, i) => (
                      <Badge key={i} variant="outline">{merchant}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid gap-4">
          {results.map((result) => (
            <Card key={result.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {result.image && (
                    <div className="w-24 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                      <img 
                        src={result.image} 
                        alt={result.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                          {result.title}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-muted-foreground">{result.merchant}</span>
                          {getAvailabilityBadge(result.availability)}
                        </div>
                        {result.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {result.description}
                          </p>
                        )}
                        {result.rating && result.rating > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="ml-1 font-medium">{result.rating.toFixed(1)}</span>
                            </div>
                            {result.reviews_count && result.reviews_count > 0 && (
                              <span className="text-muted-foreground">
                                ({result.reviews_count} avis)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {result.price}€
                        </div>
                        <Button asChild size="sm">
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            Voir l'offre
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && !isSearching && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Entrez un nom de produit pour commencer la recherche</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};