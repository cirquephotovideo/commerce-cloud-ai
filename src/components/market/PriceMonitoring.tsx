import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingDown, TrendingUp, Eye } from "lucide-react";
import { ProductMonitoringDetail } from "./ProductMonitoringDetail";

export const PriceMonitoring = () => {
  const [productName, setProductName] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [monitoring, setMonitoring] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProductOffers, setSelectedProductOffers] = useState<any[]>([]);

  useEffect(() => {
    loadSites();
    loadMonitoring();
  }, []);

  const loadSites = async () => {
    const { data } = await supabase
      .from('competitor_sites')
      .select('*')
      .eq('is_active', true);
    
    setSites(data || []);
    setSelectedSites(data?.map(s => s.id) || []);
  };

  const loadMonitoring = async () => {
    const { data } = await supabase
      .from('price_monitoring')
      .select('*, competitor_sites(site_name)')
      .order('scraped_at', { ascending: false })
      .limit(50);
    
    setMonitoring(data || []);
  };

  const handleProductClick = async (product: any) => {
    // Charger toutes les offres pour ce produit
    const { data } = await supabase
      .from('price_monitoring')
      .select('*, competitor_sites(site_name)')
      .ilike('product_name', `%${product.product_name}%`)
      .order('current_price', { ascending: true });
    
    setSelectedProduct(product);
    setSelectedProductOffers(data || []);
  };

  const handleSearch = async () => {
    if (!productName.trim()) {
      toast.error("Entrez un nom de produit");
      return;
    }

    if (selectedSites.length === 0) {
      toast.error("Sélectionnez au moins un site concurrent");
      return;
    }

    setIsSearching(true);
    
    try {
      // Ensure the user's JWT is forwarded to the edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const { data, error } = await supabase.functions.invoke('dual-search-engine', {
        body: {
          productName,
          competitorSiteIds: selectedSites,
        },
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            }
          : undefined,
      });

      if (error) {
        console.error("Price monitoring error:", error);
        toast.error("Erreur de recherche: " + (error.message || "Service temporairement indisponible"));
        setIsSearching(false);
        return;
      }

      const stats = data?.stats;
      if (stats) {
        toast.success(
          `Recherche terminée! ${stats.total_results} offres trouvées (${stats.dual_validated} validées par 2 sources)${stats.promotions_found > 0 ? ` 🔥 ${stats.promotions_found} promotions détectées!` : ''}`
        );
      } else {
        toast.success("Recherche terminée");
      }
      
      loadMonitoring();
    } catch (error: any) {
      console.error("Price monitoring exception:", error);
      toast.error("Erreur inattendue lors de la recherche");
    } finally {
      setIsSearching(false);
    }
  };

  const getPriceChange = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rechercher un Produit</CardTitle>
          <CardDescription>
            Comparez les prix en temps réel sur vos sites concurrents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nom du Produit</Label>
            <Input
              placeholder="Ex: iPhone 15 Pro 256GB"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div>
            <Label>Sites à surveiller ({selectedSites.length} sélectionnés)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sites.map((site) => (
                <label key={site.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={selectedSites.includes(site.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSites([...selectedSites, site.id]);
                      } else {
                        setSelectedSites(selectedSites.filter(id => id !== site.id));
                      }
                    }}
                  />
                  <span className="text-sm">{site.site_name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleSearch} disabled={isSearching} className="w-full">
            <Search className="w-4 h-4 mr-2" />
            {isSearching ? "Recherche en cours..." : "Rechercher les Prix"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique de Surveillance</CardTitle>
          <CardDescription>
            Cliquez sur un produit pour voir tous les détails et offres disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monitoring.map((item) => {
              const change = getPriceChange(item.current_price, item.previous_price);
              // Compter les offres similaires
              const offerCount = monitoring.filter(m => 
                m.product_name.toLowerCase() === item.product_name.toLowerCase()
              ).length;
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => handleProductClick(item)}
                  className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors group"
                >
                  <div className="flex items-start gap-4 flex-1">
                    {item.image_url && (
                      <div className="w-16 h-16 flex-shrink-0 rounded border overflow-hidden bg-accent">
                        <img 
                          src={item.image_url} 
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium group-hover:text-primary transition-colors">
                        {item.product_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.competitor_sites?.site_name || 'Site inconnu'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.scraped_at).toLocaleDateString()}
                        </div>
                        {offerCount > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {offerCount} offres
                          </Badge>
                        )}
                        {item.rating && (
                          <Badge variant="outline" className="text-xs">
                            ⭐ {item.rating.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="text-lg font-bold">{item.current_price}€</div>
                      {change !== null && (
                        <div className={`text-sm flex items-center justify-end ${change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      )}
                      <Badge 
                        variant={item.stock_status === "in_stock" ? "default" : "destructive"}
                        className="text-xs mt-1"
                      >
                        {item.stock_status === "in_stock" ? "En Stock" : "Rupture"}
                      </Badge>
                    </div>
                    
                    <Eye className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
            {monitoring.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune donnée de surveillance
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ProductMonitoringDetail
        product={selectedProduct}
        allOffers={selectedProductOffers}
        isOpen={!!selectedProduct}
        onClose={() => {
          setSelectedProduct(null);
          setSelectedProductOffers([]);
        }}
      />
    </div>
  );
};